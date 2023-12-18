import pLimit from 'p-limit';
import twilio from 'twilio';
import 'dotenv/config';
import fs from 'fs';
import { Parser } from 'json2csv';
import csv from 'csv-parser';

const parentAccountSid = process.env.TWILIO_ACCOUNT_SID;
const parentAuthToken = process.env.TWILIO_AUTH_TOKEN;
let client;

//  bottleneck set to 1 to avoid rate limiting errors
const limit = pLimit(1);

//  fields used for csv. New Fields must be added here to avoid errors.
const fields = [
  'friendlyId',
  'subaccount',
  'businessName',
  'street',
  'city',
  'state',
  'postalCode',
  'country',
  'contactEmail',
  'industry',
  'businessRegionOfOperation',
  'EIN',
  'businessStructure',
  'websiteUrl',
  'useCase',
  'useCaseDescription',
  'sampleTextOne',
  'sampleTextTwo',
  'embeddedPhone',
  'embeddedLink',
  'authorizedRepFirstName',
  'authorizedRepLastName',
  'authorizedRepEmail',
  'authorizedRepTitle',
  'authorizedRepPosition',
  'authorizedRepPhone',
  'customerType',
  'stockExchange',
  'stockTicker',
  'brandType',
  'messageFlow',
  'optIn',
  'optInMessage',
  'optOut',
  'optOutMessage',
  'helpKeywords',
  'helpMessage',
  'twilioPhone',
  'twilioPhoneUrl',
  'customerProfileSid',
  'customerProfileEval',
  'trustBundleSid',
  'trustBundleEval',
  'brandSid',
  'messagingServiceSid',
  'brandStatus',
  'brandFailureReason',
  'campaignStatus',
  'campaignFailureReason',
  'twilioPhoneAttached',
  'campaignErrorCode',
  'error',
];

//  timeout used during brand status check
export function Timeout(seconds) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, seconds * 1000);
  });
}

// json2csv parser: parses selected CSV fields
const parser = new Parser({ fields });

//  STEP 1: CREATE AND SUBMIT SECONDARY CUSTOMER PROFILE
//  1.1 Fetch the Secondary Customer Profile Policy
// Policy is static (RNdfbf3fae0e1107f8aded0e7cead80bf5) and can be hard coded during step 1.2

//  1.2 Create an empty secondary customer profile bundle

export async function createSecondaryCustomerProfilePolicy(
  sid,
  authToken,
  friendlyId,
  businessEmail
) {
  client = twilio(sid, authToken);
  return client.trusthub.v1.customerProfiles
    .create({
      friendlyName: friendlyId,

      email: businessEmail,
      policySid: 'RNdfbf3fae0e1107f8aded0e7cead80bf5',
    })
    .then((customerProfiles) => customerProfiles.sid);
}

//  1.3 Create end-user object of type: customer_profile_business_information
export async function createBusinessInformation(
  friendlyId,
  sid,
  authToken,
  businessName,
  website,
  region,
  businessType,
  businessRegistrationIdentifier,
  businessIdentity,
  businessIndustry,
  BIN
) {
  client = twilio(sid, authToken);
  return client.trusthub.v1.endUsers
    .create({
      attributes: {
        business_name: businessName,
        website_url: website,
        business_regions_of_operation: region,
        business_type: businessType,
        business_registration_identifier: businessRegistrationIdentifier,
        business_identity: businessIdentity,
        business_industry: businessIndustry,
        business_registration_number: BIN,
      },
      friendlyName: friendlyId,
      type: 'customer_profile_business_information',
    })
    .then((endUser) => endUser.sid);
}

//  1.4 Create end-user of type: authorized_representative_1

export async function createAuthorizedRep(
  sid,
  authToken,
  jobPosition,
  lastName,
  phoneNumber,
  firstName,
  email,
  businessTitle
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1.endUsers
    .create({
      attributes: {
        job_position: jobPosition,
        last_name: lastName,
        phone_number: phoneNumber,
        first_name: firstName,
        email,
        business_title: businessTitle,
      },
      friendlyName: 'auth_rep_1',
      type: 'authorized_representative_1',
    })
    .then((endUser) => endUser.sid);
}
//  1.5 Create end-user of type: authorized_representative_2 (optional)
// This step will be skipped as it is optional

//  1.6 Create supporting document: customer_profile_address

export async function createAddress(
  sid,
  authToken,
  customerName,
  street,
  city,
  region,
  postalCode,
  isoCountry
) {
  client = twilio(sid, authToken);

  return client.addresses
    .create({
      customerName,
      street,
      city,
      region,
      postalCode,
      isoCountry,
    })
    .then((address) => address.sid);
}

//  1.6.1 Create customer document (when you have a valid AddressSID)

export async function createCustomerDocument(
  friendlyId,
  sid,
  authToken,
  address
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1.supportingDocuments
    .create({
      attributes: {
        address_sids: address,
      },
      friendlyName: friendlyId,
      type: 'customer_profile_address',
    })
    .then((supportingDocument) => supportingDocument.sid);
}

//  1.7 Assign end-users, supporting document, and primary customer profile to the empty secondary customer profile that you created

export async function assignEndUsers(
  sid,
  authToken,
  secondaryCustomerProfile,
  objectSid
) {
  client = twilio(sid, authToken);

  // timeout added due to race condition
  await Timeout(2);

  return (
    client.trusthub.v1
      .customerProfiles(secondaryCustomerProfile)
      // eslint-disable-next-line object-shorthand
      .customerProfilesEntityAssignments.create({ objectSid })
      .then(
        (customerProfilesEntityAssignments) =>
          customerProfilesEntityAssignments.sid
      )
  );
}

//  1.8 Run evaluation on secondary customer profile

export async function evaluateSecondaryCustomerProfile(
  sid,
  authToken,
  secondaryCustomerProfile
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .customerProfiles(secondaryCustomerProfile)
    .customerProfilesEvaluations.create({
      policySid: 'RNdfbf3fae0e1107f8aded0e7cead80bf5',
    })
    .then((customerProfilesEvaluations) => customerProfilesEvaluations);
}

//  1.9 Submit the secondary customer profile for review

export async function submitSecondaryCustomerProfile(
  sid,
  authToken,
  secondaryCustomerProfile
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .customerProfiles(secondaryCustomerProfile)
    .update({ status: 'pending-review' })
    .then((customerProfiles) => customerProfiles.status);
}

//  STEP 2: Create an A2P Trust Product
//  2.1 Fetch A2P Profile Policy
//  Policy is static (RNb0d4771c2c98518d916a3d4cd70a8f8b) and can be hard coded during step 2.2
//  2.2 Create an empty A2P Trust Bundle

export async function createA2pTrustBundle(
  friendlyId,
  sid,
  authToken,
  businessEmail
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1.trustProducts
    .create({
      friendlyName: friendlyId,
      email: businessEmail,
      policySid: 'RNb0d4771c2c98518d916a3d4cd70a8f8b',
    })
    .then((trustProducts) => trustProducts.sid);
}

//  2.3.2 Create an end user of type us_a2p_messaging_profile_information (private companies)
export async function createEndUser(sid, authToken, friendlyName) {
  client = twilio(sid, authToken);

  return client.trusthub.v1.endUsers
    .create({
      attributes: {
        //  WARNING: company type will need to be changed if registering non-private entities
        company_type: 'private',
      },
      friendlyName,
      type: 'us_a2p_messaging_profile_information',
    })
    .then((endUser) => endUser.sid);
}

//  2.4 Assign the end user to the A2P Trust Bundle
export async function assignEndUser(sid, authToken, endUser, trustBundle) {
  client = twilio(sid, authToken);

  // timeout added due to race condition
  await Timeout(1);

  return client.trusthub.v1
    .trustProducts(trustBundle)
    .trustProductsEntityAssignments.create({ objectSid: endUser })
    .then(
      (trustProductsEntityAssignments) => trustProductsEntityAssignments.sid
    );
}

//  2.5 Assign secondary customer profile bundle to A2P trust bundle
export async function assignSecondaryCustomerProfile(
  sid,
  authToken,
  trustBundle,
  secondaryCustomerProfile
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .trustProducts(trustBundle)
    .trustProductsEntityAssignments.create({
      objectSid: secondaryCustomerProfile,
    })
    .then(
      (trustProductsEntityAssignments) => trustProductsEntityAssignments.sid
    );
}

//  2.6 Run evaluation on A2P Trust Product
export async function evaluateTrustBundle(sid, authToken, trustBundle) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .trustProducts(trustBundle)
    .trustProductsEvaluations.create({
      policySid: 'RNb0d4771c2c98518d916a3d4cd70a8f8b',
    })
    .then((trustProductsEvaluations) => trustProductsEvaluations);
}

//  2.7 Submit A2P Trust Bundle for review

export async function submitTrustBundle(sid, authToken, trustBundle) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .trustProducts(trustBundle)
    .update({ status: 'pending-review' })
    .then((trustProducts) => trustProducts.friendlyName);
}

//  STEP 3. Create an A2P Brand

export async function createLowVolumeBrand(
  sid,
  authToken,
  secondaryCustomerProfile,
  trustBundle
) {
  client = twilio(sid, authToken);

  return client.messaging.v1.brandRegistrations
    .create({
      //  WARNING: skipAutomatSecVet hard coded to "True." This means that low-volume standard is the main use-case for this script.
      skipAutomaticSecVet: true,
      //  IMPORTANT: Update to False in .env before moving to production
      mock: process.env.IS_MOCK,
      customerProfileBundleSid: secondaryCustomerProfile,
      a2PProfileBundleSid: trustBundle,
    })
    .then((brandRegistration) => brandRegistration.sid);
}

//  3.0.1 Using Fetch to check brand registration status

export async function checkBrandStatus(subaccount, auth, brandSid) {
  //  count brand status check retries. Checks every 10 seconds for 2 minutes
  client = twilio(subaccount, auth);
  let count = 0;
  let brandReg = await client.messaging.v1
    .brandRegistrations(brandSid)
    .fetch()
    .then((brandRegistration) => brandRegistration);
  while (brandReg.status === 'PENDING' && count < 11) {
    count += 1;
    Timeout(1);
    // eslint-disable-next-line no-await-in-loop
    brandReg = await client.messaging.v1
      .brandRegistrations(brandSid)
      .fetch()
      .then((brandRegistration) => brandRegistration);
  }
  return brandReg;
}

//  4. Create or Choose a Messaging Service

//  4.1 Create a new Messaging Service

export async function createMessagingService(sid, auth, friendlyId) {
  client = twilio(sid, auth);

  return client.messaging.v1.services
    .create({
      friendlyName: friendlyId,
    })
    .then((service) => service.sid);
}

//  5. Create an A2P Campaign
//  5.2 Create A2P Campaign

export async function createCampaign(
  sid,
  authToken,
  optInMessage,
  description,
  messageFlow,
  usAppToPersonUsecase,
  brandSid,
  messagingServiceSid,
  sampleTextOne,
  sampleTextTwo,
  optOutMessage,
  helpMessage,
  helpKeywords,
  optOutKeywords,
  optInKeywords
) {
  client = twilio(sid, authToken);
  //  timeout added for race conditions
  await Timeout(1);
  return client.messaging.v1
    .services(messagingServiceSid)
    .usAppToPerson.create({
      optInKeywords,
      optInMessage,
      optOutKeywords: [optOutKeywords],
      optOutMessage,
      helpKeywords: [helpKeywords],
      helpMessage,
      description,
      messageFlow,
      messageSamples: [sampleTextOne, sampleTextTwo],
      usAppToPersonUsecase,
      //  WARNING: embedded links and phone numbers are hard coded to true. Update to false if not using embedded links or phone numbers
      hasEmbeddedLinks: true,
      hasEmbeddedPhone: true,
      brandRegistrationSid: brandSid,
    })
    .then((usAppToPerson) => usAppToPerson.sid);
}

//  5.3 Check your Campaign registration status

export async function getCampaignStatus(sid, authToken, messagingServiceSid) {
  client = twilio(sid, authToken);

  return client.messaging.v1
    .services(messagingServiceSid)
    .usAppToPerson('QE2c6890da8086d771620e9b13fadeba0b')
    .fetch()
    .then((usAppToPerson) => usAppToPerson);
}

//  write to CSV

export async function writeCSV(filePath, data) {
  const csvData = parser.parse(data);

  fs.writeFile(filePath, csvData, (err) => {
    if (err) {
      console.log('write CSV error ', err);
    }
  });
}

// Push each updated CSV row to new JSON object

export async function pushRows(row, rows) {
  rows.push(row);
  return rows;
}

//  streams CSV to JSON

export async function streamCsv(csvString) {
  return new Promise((resolve, reject) => {
    const array = [];
    fs.createReadStream(csvString)
      .pipe(csv())
      .on('data', (data) => array.push(data))
      .on('end', () => {
        resolve(array);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

//  update phone number resource
export async function attachNumberUrl(
  subaccount,
  auth,
  phoneNumberSid,
  smsUrl
) {
  client = twilio(subaccount, auth);
  client
    .incomingPhoneNumbers(phoneNumberSid)
    .update({
      smsUrl,
    })
    .then((incomingPhoneNumber) => incomingPhoneNumber.friendlyName);
}

//  6. Ensure that a Twilio 10DLC phone number is associated with your new Campaign

export async function addPhoneNumbers(
  sid,
  authToken,
  messagingServiceSid,
  phoneNumber,
  url
) {
  client = twilio(sid, authToken);

  //  get phone number SID
  const pnSID = await client.incomingPhoneNumbers
    .list({ phoneNumber })
    .then((incomingPhoneNumbers) => incomingPhoneNumbers[0].sid);
  if (url !== '') {
    //  run function to attach URL to phone number
    await attachNumberUrl(sid, authToken, pnSID, url);
  }
  return client.messaging.v1
    .services(messagingServiceSid)
    .phoneNumbers.create({
      phoneNumberSid: pnSID,
    })
    .then((numberInfo) => numberInfo.sid);
}

// get subaccount info
export async function getSubaccountToken(SID) {
  client = twilio(parentAccountSid, parentAuthToken);
  return client.api.v2010
    .accounts(SID)
    .fetch()
    .then((account) => account.authToken);
}

// Update campaign status

export async function updateStatus(data) {
  const rows = [];
  let campaignStatus;
  const promises = data.map(async (row) => {
    await limit(async () => {
      const rowData = row;
      const authToken = await getSubaccountToken(rowData.subaccount);
      client = twilio(rowData.subaccount, authToken);
      if (rowData.campaignStatus === 'IN_PROGRESS') {
        try {
          campaignStatus = await getCampaignStatus(
            rowData.subaccount,
            authToken,
            row.messagingServiceSid
          );
          rowData.campaignStatus = campaignStatus.campaignStatus;
        } catch (error) {
          rowData.error = `error getting campaign update ${error}`;
        }
      }
      if (rowData.campaignStatus === 'FAILED') {
        rowData.campaignErrorCode = campaignStatus.errors[0].error_code;
        rowData.campaignFailureReason = campaignStatus.errors[0].description;
      }
      rows.push(rowData);
    });
  });
  await Promise.all(promises);
  return rows;
}

// Stream CSV to update campaign status

export async function updateCampaigns() {
  let results = [];
  let jsonResults = [];
  const fileOutput = process.env.FILE_OUTPUT;
  try {
    results = await streamCsv(fileOutput);
  } catch (error) {
    console.log('unable to stream CSV: ', error);
  }
  try {
    jsonResults = await updateStatus(results);
  } catch (error) {
    console.log('unable to get json Results', error);
  }
  if (jsonResults[0]) {
    try {
      await writeCSV(fileOutput, jsonResults);
    } catch (error) {
      console.log(`write CSV Error:${error}`);
    }
  }
}

//  function to check that the input csv matches the expected header fields

async function headerChecker(input) {
  let match = true;
  //  loop through fields variable, comparing to input csv
  const keys = Object.keys(input[0]);
  for (let i = 0; i < keys.length; i += 1) {
    const field = keys[i];
    if (match === true) {
      if (field !== fields[i]) {
        console.log(
          `Input does not match expected CSV headers from the input file with header ${field}. Expected header is ${fields[i]}`
        );
        match = false;
      }
    }
    i += 1;
  }
  return match;
}

//  generic stream csv function
export async function updateCSV(input, output, updateCSVStatus) {
  let csvMatch = true;
  let results = [];
  let jsonResults = [];
  try {
    //  turn input csv into JSON
    results = await streamCsv(input);
    //  check that csv headers match expected values
    csvMatch = await headerChecker(results);
    // if csvMatch is false, exit function
    if (csvMatch === false) {
      throw Error(
        `Input does not match expected CSV headers. Check console logs for more details`
      );
    }
  } catch (error) {
    console.log('unable to stream CSV: ', error);
  }
  if (csvMatch === true) {
    try {
      jsonResults = await updateCSVStatus(results);
    } catch (error) {
      console.log('unable to get json Results', error);
    }
    if (jsonResults[0]) {
      try {
        await writeCSV(output, jsonResults);
      } catch (error) {
        console.log(`write CSV Error:${error}`);
      }
    } else {
      console.log('no JSON data to record to CSV');
    }
  }
}

//  update customer profile

export async function updateCustomerProfile(sid, auth, object, bundle) {
  client = twilio(sid, auth);
  await client.trusthub.v1.customerProfiles(bundle).update(object);
}

//  Update end user

export async function updateEndUsers(sid, auth, object, bundle) {
  client = twilio(sid, auth);

  await client.trusthub.v1
    .endUsers(bundle)
    .update(object)
    .then((endUser) => endUser);
}

//  update brand

export async function updateBrand(sid, auth, brandSid) {
  client = twilio(sid, auth);
  return client.messaging.v1
    .brandRegistrations(brandSid)
    .update()
    .then((brand) => brand.status);
}

//  run campaign registrations

export async function runCampaigns(rowJson) {
  let rows = [];
  const promises = rowJson.map(async (row) => {
    await limit(async () => {
      const rowData = row;
      let { optIn } = rowData;
      optIn = optIn.replace(/[\\[\]"]/g, '');
      optIn = optIn.split(',');
      rowData.optIn = optIn;
      const authToken = await getSubaccountToken(rowData.subaccount);
      if (rowData.brandSid) {
        //  3.0.1 Using Fetch to check brand registration status
        const brandRegistration = await checkBrandStatus(
          rowData.subaccount,
          authToken,
          rowData.brandSid
        );
        const brandStatus = brandRegistration.status;
        rowData.brandStatus = brandStatus;
        if (
          rowData.error === '' &&
          brandStatus === 'FAILED' &&
          brandRegistration.brandFeedback !== null
        ) {
          const brandFailureReason = brandRegistration.brandFeedback;
          rowData.brandFailureReason = brandFailureReason;
        } else if (rowData.error === '' && brandStatus === 'FAILED') {
          const brandFailureReason = brandRegistration.failureReason;
          rowData.brandFailureReason = brandFailureReason;
        }
        //  4. Create or Choose a Messaging Service

        //  4.1 Create a new Messaging Service
        //  WARNING: Messaging Service is set to default webhook property of "defer to sender's webhook." Ensure you add a URL to the TwilioPhoneUrl column if one is not set yet.
        else if (rowData.error === '' && brandStatus === 'APPROVED') {
          let messagingServiceSid;
          let campaignStatus;
          try {
            messagingServiceSid = await createMessagingService(
              row.subaccount,
              authToken,
              row.friendlyId
            );
            rowData.messagingServiceSid = messagingServiceSid;
          } catch (error) {
            rowData.error = `messaging service creation error ${error}`;
          }
          //  5. Create an A2P Campaign
          //  5.2 Create A2P Campaign
          if (rowData.error === '') {
            try {
              await createCampaign(
                row.subaccount,
                authToken,
                row.optInMessage,
                row.useCaseDescription,
                row.messageFlow,
                row.useCase,
                row.brandSid,
                messagingServiceSid,
                row.sampleTextOne,
                row.sampleTextTwo,
                row.optOutMessage,
                row.helpMessage,
                row.helpKeywords,
                row.optOut,
                row.optIn
              );
              //  get campaign status after messaging service creation
              campaignStatus = await getCampaignStatus(
                row.subaccount,
                authToken,
                messagingServiceSid
              );
              rowData.campaignStatus = campaignStatus.campaignStatus;
            } catch (error) {
              rowData.error = `campaign creation error ${error}`;
            }
          }
        }
      }
      rows = await pushRows(rowData, rows);
    });
  });
  await Promise.all(promises);
  return rows;
}

//  create subaccounts
export async function createSubaccount(name) {
  client = twilio(parentAccountSid, parentAuthToken);
  return client.api.v2010.accounts
    .create({ friendlyName: name })
    .then((accountInfo) => accountInfo);
}
// Testing new function for pulling all bundle info from customer profile sid. This will avoid having to log unnecessary SIDs to csv
export async function getAllSids(sid, authToken, customerProfileBundleSid) {
  client = twilio(sid, authToken);
  return client.trusthub.v1
    .customerProfiles(customerProfileBundleSid)
    .fetch()
    .then((customerProfile) => customerProfile);
}

//  Update Address SID

//  Check Customer Profile Status
export async function getCustomerProfileStatus(
  sid,
  authToken,
  customerProfileBundleSid
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .customerProfiles(customerProfileBundleSid)
    .list({ limit: 1 })
    .then((customerProfiles) => customerProfiles.status);
}

//  Fetch EndUser SIDs
export async function getEndUserSids(sid, authToken, customerProfileBundleSid) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .customerProfiles(customerProfileBundleSid)
    .customerProfilesEntityAssignments.list({ limit: 20 })
    .then((endUsers) => endUsers);
}

//  Get Supporting Document
//  "https://trusthub.twilio.com/v1/SupportingDocuments/RDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

export async function getSupportingDocument(sid, authToken, objectSid) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .supportingDocuments(objectSid)
    .fetch()
    .then((supportingDocuments) => supportingDocuments);
}

//  Get Address Info
// export async function getAddressInfo(sid, authToken, objectSid) {
//   client = twilio(sid, authToken);

//   return client.addresses.list({ limit: 1 }).then((address) => address);
// }

//  Update Address Info
export async function updateAddress(sid, authToken, objectSid, addressInfo) {
  client = twilio(sid, authToken);

  return client
    .addresses(objectSid)
    .update(addressInfo)
    .then((address) => address);
}

//  Fetch EndUser info
export async function getEndUserType(sid, authToken, objectSid) {
  client = twilio(sid, authToken);
  const objectBeginning = objectSid.substring(0, 2);

  let type = '';
  if (objectBeginning === 'IT') {
    type = client.trusthub.v1
      .endUsers(objectSid)
      .fetch()
      .then((endUser) => endUser.type);
  } else if (objectBeginning === 'RD') {
    type = 'address';
  }
  return type;
}

//  Get trust bundle status

export async function getTrustBundleStatus(
  sid,
  authToken,
  trustProductBundleSid
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .trustProducts(trustProductBundleSid)
    .fetch()
    .then((trustProducts) => trustProducts.status);
}

//  Update Trust Bundle
export async function updateTrustBundle(
  sid,
  authToken,
  trustProductBundleSid,
  trustBundleInfo
) {
  client = twilio(sid, authToken);

  return client.trusthub.v1
    .trustProducts(trustProductBundleSid)
    .update(trustBundleInfo)
    .then((trustProducts) => trustProducts);
}
