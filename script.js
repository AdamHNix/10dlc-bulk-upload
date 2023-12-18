import pLimit from 'p-limit';
import * as functions from './Functions.js';

const parentAccountSid = process.env.TWILIO_ACCOUNT_SID;
const parentAuthToken = process.env.TWILIO_AUTH_TOKEN;

//  log file paths for your input file and output file in .env
const filePath = process.env.FILE_PATH;
const fileOutput = process.env.FILE_OUTPUT;

//  bottleneck set to 1 to avoid rate limiting errors
const limit = pLimit(1);

//  function to run through CSV Array to get Header values
// eslint-disable-next-line import/prefer-default-export
export async function runCSV(data) {
  let rows = [];
  const promises = data.map(async (row) => {
    await limit(async () => {
      //  log row number
      console.log(`started row ${data.indexOf(row) + 2}`);
      if (row.businessName === '' || row.customerProfileSid !== '') {
        // empty - skips any empty columns by checking the business name
      } else {
        const rowData = row;
        //  set up opt-in Array
        let { optIn } = rowData;
        optIn = optIn.replace(/[\\[\]"]/g, '');
        optIn = optIn.split(',');
        rowData.optIn = optIn;
        const primaryCustomerProfileSID = process.env.PRIMARY_CUSTOMER_PROFILE;
        //  create subaccount
        let subaccountSID;
        let subaccountInfo;
        let subaccountAuth;
        //  create new subaccount if subaccount key is empty
        if (rowData.subaccount === '') {
          subaccountInfo = await functions.createSubaccount(rowData.friendlyId);
          subaccountSID = subaccountInfo.sid;
          subaccountAuth = subaccountInfo.authToken;
          rowData.subaccount = subaccountSID;
          //  use current subaccount if Sid does not patch parent
        } else if (rowData.subaccount !== parentAccountSid) {
          subaccountSID = rowData.subaccount;
          subaccountAuth = await functions.getSubaccountToken(subaccountSID);
          //  use parent
        } else {
          subaccountSID = parentAccountSid;
          subaccountAuth = parentAuthToken;
        }

        //  1.2 Create an empty secondary customer profile bundle
        let customerProfileSid;
        try {
          customerProfileSid = await functions.createSecondaryCustomerProfilePolicy(
            subaccountSID,
            subaccountAuth,
            row.friendlyId,
            row.contactEmail
          );
          rowData.customerProfileSid = customerProfileSid;
        } catch (error) {
          rowData.error = `customerProfileSid Error for row ${data.indexOf(
            row
          ) + 2} ${error}`;
        }

        let businessInformation;
        if (rowData.error === '') {
          //  1.3 Create end-user object of type: customer_profile_business_information
          try {
            businessInformation = await functions.createBusinessInformation(
              row.friendlyId,
              subaccountSID,
              subaccountAuth,
              row.businessName,
              row.websiteUrl,
              row.businessRegionOfOperation,
              row.businessStructure,
              //  WARNING: EIN is hardcoded as the BIN for this script. This script can't currently register international profiles.
              'EIN',
              'direct_customer',
              row.industry,
              row.EIN
            );

            rowData.businessInformationSid = businessInformation;
          } catch (error) {
            rowData.error = `businessInformation Error for row ${data.indexOf(
              row
            ) + 2} ${error}`;
          }
        }

        //  1.4 Create end-user of type: authorized_representative_1
        let authorizedRep;
        if (rowData.error === '') {
          try {
            authorizedRep = await functions.createAuthorizedRep(
              subaccountSID,
              subaccountAuth,
              rowData.authorizedRepPosition,
              rowData.authorizedRepLastName,
              rowData.authorizedRepPhone,
              rowData.authorizedRepFirstName,
              rowData.authorizedRepEmail,
              rowData.authorizedRepTitle
            );
            rowData.authorizedRepSid = authorizedRep;
          } catch (error) {
            rowData.error = `authorizedRep Error for row ${data.indexOf(row) +
              2} ${error}`;
          }
        }
        //  1.6 Create supporting document: customer_profile_address
        let address;
        if (rowData.error === '') {
          try {
            address = await functions.createAddress(
              subaccountSID,
              subaccountAuth,
              row.businessName,
              row.street,
              row.city,
              row.state,
              row.postalCode,
              row.country
            );
            rowData.addressSid = address;
          } catch (error) {
            rowData.error = `address Error for row ${data.indexOf(row) +
              2} ${error}`;
          }
        }

        //  1.6.1 Create customer document (when you have a valid AddressSID)
        let customerDocument;
        if (rowData.error === '') {
          try {
            customerDocument = await functions.createCustomerDocument(
              row.friendlyId,
              subaccountSID,
              subaccountAuth,
              address
            );
            rowData.customerDocumentSid = customerDocument;
          } catch (error) {
            rowData.error = `customerDocument Error for row ${data.indexOf(
              row
            ) + 2} ${error}`;
          }
        }

        // 1.7 Assign end-users, supporting document, and primary customer profile to the empty secondary customer profile that you created

        //  1.7.1 assign end-user (authorized rep)
        if (rowData.error === '') {
          try {
            await functions.assignEndUsers(
              subaccountSID,
              subaccountAuth,
              customerProfileSid,
              authorizedRep
            );
          } catch (error) {
            rowData.error = `end-user assignement Error for row ${data.indexOf(
              row
            ) + 2} ${error}`;
          }
        }
        //  1.7.2 assign supporting documents (address)
        if (rowData.error === '') {
          try {
            await functions.assignEndUsers(
              subaccountSID,
              subaccountAuth,
              customerProfileSid,
              customerDocument
            );
          } catch (error) {
            rowData.error = `supporting documents assignement Error for row ${data.indexOf(
              row
            ) + 2} ${error}`;
          }
        }
        //  1.7.3 assign business information
        if (rowData.error === '') {
          try {
            await functions.assignEndUsers(
              subaccountSID,
              subaccountAuth,
              customerProfileSid,
              businessInformation
            );
          } catch (error) {
            rowData.error = `business information assignement Error for row ${data.indexOf(
              row
            ) + 2} ${error}`;
          }
        }
        //  1.7.4 assign primary customer profile
        if (rowData.error === '') {
          try {
            await functions.assignEndUsers(
              subaccountSID,
              subaccountAuth,
              customerProfileSid,
              primaryCustomerProfileSID
            );
          } catch (error) {
            rowData.error = `primary profile assignement Error for row ${data.indexOf(
              row
            ) + 2} ${error}`;
          }
        }

        //  1.8 Run evaluation on secondary customer profile

        if (rowData.error === '' && customerProfileSid) {
          try {
            const evaluation = await functions.evaluateSecondaryCustomerProfile(
              subaccountSID,
              subaccountAuth,
              customerProfileSid
            );
            rowData.customerProfileEval = evaluation.status;
            if (evaluation.status !== 'compliant') {
              const report = [];
              evaluation.results.forEach((object) => {
                if (object.passed === false) {
                  report.push(object.object_type);
                }
              });
              throw new Error(
                `non-compliant customer profile. The following objects failed evaluation: ${report}`
              );
            }
          } catch (error) {
            console.log(error.message);
            rowData.error = error.message;
          }
        }

        //  1.9 Submit the secondary customer profile for review
        if (
          rowData.error === '' &&
          rowData.customerProfileEval === 'compliant'
        ) {
          try {
            await functions.submitSecondaryCustomerProfile(
              subaccountSID,
              subaccountAuth,
              customerProfileSid
            );
          } catch (error) {
            rowData.error = `secondary profile submission error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
        }

        //  STEP 2: Create an A2P Trust Product
        //  2.2 Create an empty A2P Trust Bundle
        let a2pTrustBundle;
        if (
          rowData.error === '' &&
          rowData.customerProfileEval === 'compliant'
        ) {
          try {
            a2pTrustBundle = await functions.createA2pTrustBundle(
              row.friendlyId,
              subaccountSID,
              subaccountAuth,
              row.businessName,
              row.contactEmail
            );
            rowData.trustBundleSid = a2pTrustBundle;
          } catch (error) {
            rowData.error = `trust hub bundle creation error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
        }
        //  2.3.2 Create an end user of type us_a2p_messaging_profile_information (private companies)
        let trustBundleEndUser;
        if (
          rowData.error === '' &&
          rowData.customerProfileEval === 'compliant'
        ) {
          try {
            trustBundleEndUser = await functions.createEndUser(
              subaccountSID,
              subaccountAuth,
              row.friendlyId
            );
            //  2.4 Assign the end user to the A2P Trust Bundle
            await functions.assignEndUser(
              subaccountSID,
              subaccountAuth,
              trustBundleEndUser,
              a2pTrustBundle
            );
            //  2.5 Assign secondary customer profile bundle to A2P trust bundle
            await functions.assignSecondaryCustomerProfile(
              subaccountSID,
              subaccountAuth,
              a2pTrustBundle,
              customerProfileSid
            );
          } catch (error) {
            rowData.error = `trust hub assignment error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
        }

        //  2.6 Run evaluation on A2P Trust Product
        if (
          rowData.error === '' &&
          rowData.customerProfileEval === 'compliant'
        ) {
          try {
            const TrustBundleEval = await functions.evaluateTrustBundle(
              subaccountSID,
              subaccountAuth,
              a2pTrustBundle
            );
            rowData.trustBundleEval = TrustBundleEval.status;
            if (TrustBundleEval.status !== 'compliant') {
              throw new Error(
                `non-compliant trust bundle: ${JSON.stringify(
                  TrustBundleEval.results
                )}`
              );
            }
          } catch (error) {
            rowData.error = error;
          }
        }

        //  2.7 Submit A2P Trust Bundle for review
        let brandRegistration;
        if (rowData.brandSid) {
          try {
            brandRegistration = await functions.checkBrandStatus(
              subaccountSID,
              subaccountAuth,
              row.brandSid
            );
            rowData.brandStatus = brandRegistration.status;
          } catch (error) {
            rowData.error = `check brand status error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
        }

        if (rowData.error === '' && rowData.trustBundleEval === 'compliant') {
          try {
            await functions.submitTrustBundle(
              subaccountSID,
              subaccountAuth,
              a2pTrustBundle
            );
          } catch (error) {
            rowData.error = `Trust hub error for row ${data.indexOf(row) +
              2}: ${error}`;
          }
        }
        //  STEP 3. Create an A2P Brand
        let brandSid;
        if (rowData.error === '' && rowData.trustBundleEval === 'compliant') {
          try {
            brandSid = await functions.createLowVolumeBrand(
              subaccountSID,
              subaccountAuth,
              customerProfileSid,
              a2pTrustBundle
            );
            rowData.brandSid = brandSid;
          } catch (error) {
            rowData.error = `Brand error for row ${data.indexOf(row) +
              2}: ${error}`;
          }
        }
        rows = await functions.pushRows(rowData, rows);
      }
    });
    //  log row number
    console.log(`finished row ${data.indexOf(row) + 2}`);
  });
  await Promise.all(promises);

  return rows;
}

/*  function to run full script. streams existing csv, runs the script and adds all data
    an array of JSON objects, and translates the results into new csv */
await functions.updateCSV(filePath, fileOutput, runCSV);
