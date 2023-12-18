import pLimit from 'p-limit';
import * as functions from './Functions.js';

//  log file paths for your input file and output file in .env
const filePath = process.env.UPDATE_FILE;
const fileOutput = process.env.UPDATE_FILE_OUTPUT;

const limit = pLimit(1);

//  function to run through CSV Array to get Header values
// eslint-disable-next-line import/prefer-default-export
export async function runUpdateBrandCSV(data) {
  let rows = [];
  let objectPromises;
  const promises = data.map(async (row) => {
    await limit(async () => {
      //  log progress
      console.log(`started row ${data.indexOf(row) + 2}`);

      //  make a copy of the row to edit
      const rowData = row;

      rowData.error = '';

      //  set up opt-in Array
      let { optIn } = rowData;
      optIn = optIn.split(',');
      rowData.optIn = optIn;

      //  need authentication at the subaccount level for registration
      let subaccountAuth;
      try {
        subaccountAuth = await functions.getSubaccountToken(rowData.subaccount);
      } catch (error) {
        rowData.error = `subaccount auth error for row ${data.indexOf(row) +
          2}: ${error}`;
      }

      //  3.0.1 Using Fetch to check brand registration status
      let brandStatus;

      if (rowData.error === '') {
        try {
          brandStatus = await functions.checkBrandStatus(
            row.subaccount,
            subaccountAuth,
            row.brandSid
          );
        } catch (error) {
          rowData.error = `brand status error for row ${data.indexOf(row) +
            2}: ${error}`;
        }
      }

      //  tcr ID is used to determine whether you have been charged $4 for submission
      let { tcrId } = brandStatus;

      if (tcrId === null) {
        tcrId = '';
      }

      if (tcrId === undefined) {
        tcrId = '';
      }

      //  get all sids associated with a customer profile (end user bundles and address)
      let customerProfileSids;
      if (rowData.error === '') {
        try {
          customerProfileSids = await functions.getAllSids(
            rowData.subaccount,
            subaccountAuth,
            rowData.customerProfileSid
          );
        } catch (error) {
          rowData.error = `customer profile sids error for row ${data.indexOf(
            row
          ) + 2}: ${error}`;
        }
      }
      const { status } = customerProfileSids;
      let customerProfileObject;

      if (status === `draft`) {
        customerProfileObject = {
          friendlyName: row.friendlyId,
          businesName: row.businessName,
          websiteUrl: row.websiteUrl,
          businessRegionsOfOperations: row.businessRegionOfOperation,
          businessType: row.businessStructure,
          businessRegistrationIdentifier: 'EIN',
          businessIdentity: 'direct_customer',
          businessIndustry: row.industry,
          businessRegistrationNumber: row.EIN,
        };
      } else if (status === `in-review`) {
        rowData.error =
          "Customer Profile is 'in-review' and cannot be updated. Try again later. If issue persists, restart from scratch or contact support. ";
      } else if (status === 'twilio-approved') {
        rowData.error =
          'Customer Profile is already approved and cannot be updated. Start from scratch or request support put it back into draft status.';
      } else {
        customerProfileObject = {
          status: 'draft',
          friendlyName: row.friendlyId,
          businessName: row.businessName,
          websiteUrl: row.websiteUrl,
          businessRegionsOfOperations: row.businessRegionOfOperation,
          businessType: row.businessStructure,
          businessRegistrationIdentifier: 'EIN',
          businessIdentity: 'direct_customer',
          businessIndustry: row.industry,
          businessRegistrationNumber: row.EIN,
        };
      }

      if (status !== 'in-review' && status !== 'twilio-approved') {
        customerProfileObject = {
          friendlyName: row.friendlyId,
          businesName: row.businessName,
          websiteUrl: row.websiteUrl,
          businessRegionsOfOperations: row.businessRegionOfOperation,
          businessType: row.businessStructure,
          businessRegistrationIdentifier: 'EIN',
          businessIdentity: 'direct_customer',
          businessIndustry: row.industry,
          businessRegistrationNumber: row.EIN,
        };

        const businessObject = {
          attributes: {
            business_name: row.businessName,
            website_url: row.websiteUrl,
            business_regions_of_operation: row.businessRegionOfOperation,
            business_type: row.businessStructure,
            business_registration_identifier: 'EIN',
            business_identity: 'direct_customer',
            business_industry: row.industry,
            business_registration_number: row.EIN,
          },
        };

        const authorizedRepObject = {
          attributes: {
            phone_number: row.authorizedRepPhone,
            job_position: row.authorizedRepPosition,
            first_name: row.authorizedRepFirstName,
            last_name: row.authorizedRepLastName,
            business_title: row.authorizedRepTitle,
            email: row.authorizedRepEmail,
          },
        };

        const addressObject = {
          customerName: row.businessName,
          street: row.street,
          city: row.city,
          region: row.state,
          postalCode: row.postalCode,
          isoCountry: row.country,
        };
        let endUserSids;

        try {
          endUserSids = await functions.getEndUserSids(
            row.subaccount,
            subaccountAuth,
            row.customerProfileSid
          );
        } catch (error) {
          rowData.error = `end user sids error for row ${data.indexOf(row) +
            2}: ${error}`;
        }

        objectPromises = endUserSids.map(async (object) => {
          const { objectSid } = object;
          let type;
          try {
            type = await functions.getEndUserType(
              row.subaccount,
              subaccountAuth,
              objectSid
            );
          } catch (error) {
            rowData.error = `end user type error for row ${data.indexOf(row) +
              2}: ${error}`;
          }

          switch (type) {
            case 'customer_profile_business_information':
              try {
                await functions.updateEndUsers(
                  row.subaccount,
                  subaccountAuth,
                  businessObject,
                  objectSid
                );
              } catch (error) {
                rowData.error = `business object error for row ${data.indexOf(
                  row
                ) + 2}: ${error}`;
              }
              break;
            case 'authorized_representative_1':
              try {
                await functions.updateEndUsers(
                  row.subaccount,
                  subaccountAuth,
                  authorizedRepObject,
                  objectSid
                );
              } catch (error) {
                rowData.error = `authorized rep object error for row ${data.indexOf(
                  row
                ) + 2}: ${error}`;
              }
              break;
            case 'authorized_representative_2':
              //  skip authorized rep 2 bundles
              break;
            case 'customer_profile_address':
              // skip customer profile address
              break;
            case 'address':
              {
                let supportingDoc;
                try {
                  supportingDoc = await functions.getSupportingDocument(
                    row.subaccount,
                    subaccountAuth,
                    objectSid
                  );
                } catch (error) {
                  rowData.error = `supporting doc error for row ${data.indexOf(
                    row
                  ) + 2}: ${error}`;
                }
                let addressSid;
                try {
                  addressSid = await supportingDoc.attributes.address_sids;
                } catch (error) {
                  rowData.error = `address sid error for row ${data.indexOf(
                    row
                  ) + 2}: ${error}`;
                }
                try {
                  await functions.updateAddress(
                    row.subaccount,
                    subaccountAuth,
                    addressSid,
                    addressObject
                  );
                } catch (error) {
                  rowData.error = `address object error for row ${data.indexOf(
                    row
                  ) + 2}: ${error}`;
                }
              }
              break;
            case '':
              //  skip empty type
              break;
            default:
              console.log(`no match`, type);
          }
        });
        try {
          await Promise.all(objectPromises);
        } catch (error) {
          rowData.error = `can't retrieve objects on row${data.indexOf(row) +
            2}: ${error}`;
        }

        try {
          await functions.updateCustomerProfile(
            row.subaccount,
            subaccountAuth,
            customerProfileObject,
            row.customerProfileSid
          );
        } catch (error) {
          rowData.error = `customer profile update error for row ${data.indexOf(
            row
          ) + 2}: ${error}`;
        }

        let newEval;
        try {
          newEval = await functions.evaluateSecondaryCustomerProfile(
            row.subaccount,
            subaccountAuth,
            row.customerProfileSid
          );
        } catch (error) {
          rowData.error = `customer profile eval error for row ${data.indexOf(
            row
          ) + 2}: ${error}`;
        }

        if (newEval.status !== 'compliant') {
          rowData.error = newEval;
        } else {
          rowData.customerProfileEval = newEval.status;

          try {
            await functions.submitSecondaryCustomerProfile(
              row.subaccount,
              subaccountAuth,
              row.customerProfileSid
            );
          } catch (error) {
            rowData.error = `customer profile submission error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
        }

        //  Trust Bundle Updates
        let trustObject;
        if (
          rowData.customerProfileEval === 'compliant' &&
          rowData.trustBundleSid === ``
        ) {
          let a2pTrustBundle;
          try {
            a2pTrustBundle = await functions.createA2pTrustBundle(
              row.friendlyId,
              row.subaccount,
              subaccountAuth,
              row.contactEmail
            );
          } catch (error) {
            rowData.error = `trust bundle creation error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
          rowData.trustBundleSid = a2pTrustBundle;
          let trustBundleEndUser;
          try {
            trustBundleEndUser = await functions.createEndUser(
              row.subaccount,
              subaccountAuth,
              row.friendlyId
            );
          } catch (error) {
            rowData.error = `trust hub assignment error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
          //  2.4 Assign the end user to the A2P Trust Bundle
          try {
            await functions.assignEndUser(
              row.subaccount,
              subaccountAuth,
              trustBundleEndUser,
              a2pTrustBundle
            );
          } catch (error) {
            rowData.error = `trust bundle end user assignment error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
          //  2.5 Assign secondary customer profile bundle to A2P trust bundle
          try {
            await functions.assignSecondaryCustomerProfile(
              row.subaccount,
              subaccountAuth,
              a2pTrustBundle,
              row.customerProfileSid
            );
          } catch (error) {
            rowData.error = `trust bundle secondary customer profile assignment error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
        } else if (
          rowData.customerProfileEval === 'compliant' &&
          rowData.trustBundleEval !== `compliant`
        ) {
          let trustStatus;
          try {
            trustStatus = await functions.getTrustBundleStatus(
              row.subaccount,
              subaccountAuth,
              rowData.trustBundleSid
            );
          } catch (error) {
            rowData.error = `trust bundle status error for row ${data.indexOf(
              row
            ) + 2}: ${error}`;
          }
          if (trustStatus === 'draft') {
            trustObject = {
              friendlyName: row.friendlyId,
              email: row.contactEmail,
            };
          } else {
            trustObject = {
              status: 'draft',
              friendlyName: row.friendlyId,
              email: row.contactEmail,
            };
          }
          await functions.updateTrustBundle(
            row.subaccount,
            subaccountAuth,
            rowData.trustBundleSid,
            trustObject
          );
        }
        if (rowData.customerProfileEval === 'compliant') {
          try {
            const TrustBundleEval = await functions.evaluateTrustBundle(
              row.subaccount,
              subaccountAuth,
              row.trustBundleSid
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
        if (rowData.trustBundleEval === 'compliant') {
          try {
            await functions.submitTrustBundle(
              row.subaccount,
              subaccountAuth,
              row.trustBundleSid
            );
          } catch (error) {
            rowData.error = `Trust hub error for row ${data.indexOf(row) +
              2}: ${error}`;
          }
        }

        //  Brand Update
        if (tcrId !== '' && rowData.brandSid !== '') {
          try {
            const brandSid = await functions.createLowVolumeBrand(
              row.subaccount,
              subaccountAuth,
              row.customerProfileSid,
              row.trustBundleSid
            );
            rowData.brandSid = brandSid;
          } catch (error) {
            rowData.error = `Brand error for row ${data.indexOf(row) +
              2}: ${error}`;
          }
          let newBrandStatus;
          try {
            newBrandStatus = await functions.updateBrand(
              row.subaccount,
              subaccountAuth,
              row.brandSid
            );
          } catch (error) {
            rowData.error = `Brand error for row ${data.indexOf(row) +
              2}: ${error}`;
          }
          rowData.brandStatus = newBrandStatus;
          rowData.brandFailureReason = '';
          rowData.error = '';
        } else if (tcrId === '' && rowData.brandSid === '') {
          let brandSid;
          try {
            brandSid = await functions.createLowVolumeBrand(
              rowData.subaccount,
              subaccountAuth,
              rowData.customerProfileSid,
              rowData.trustBundleSid
            );
            rowData.brandSid = brandSid;
          } catch (error) {
            rowData.error = `Brand error for row ${data.indexOf(row) +
              2}: ${error}`;
          }
        } else {
          rowData.error = `No External Brand Sid available, so updates are not allowed. Restart from scratch. You have not been charged.`;
        }
      }

      rows = await functions.pushRows(rowData, rows);
    });
    console.log(`finished row ${data.indexOf(row) + 2}`);
  });
  await Promise.all(promises);

  return rows;
}

await functions.updateCSV(filePath, fileOutput, runUpdateBrandCSV);
