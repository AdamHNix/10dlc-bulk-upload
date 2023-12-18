import pLimit from 'p-limit';
import * as functions from './Functions.js';

//  Limit to 1 concurrent API call
const limit = pLimit(1);

//  Add numbers to JSON Object by Row
async function addNumbers(data) {
  const rows = [];
  const promises = data.map(async (row) => {
    await limit(async () => {
      const rowData = row;
      //  Only adds numbers if campaignStatus is "verified" and twilioPhoneAttached is not "Y"
      if (
        row.twilioPhone &&
        row.messagingServiceSid &&
        row.twilioPhoneAttached !== 'Y' &&
        row.campaignStatus === 'VERIFIED'
      ) {
        try {
          const authToken = await functions.getSubaccountToken(
            rowData.subaccount
          );
          functions.addPhoneNumbers(
            row.subaccount,
            authToken,
            row.messagingServiceSid,
            row.twilioPhone,
            row.twilioPhoneUrl
          );
          //  add twilioPhoneAttached = 'Y' to row to indicate that phone number has been attached
          rowData.twilioPhoneAttached = 'Y';
        } catch (error) {
          rowData.error = `error allocating phone number ${error}`;
        }
      }
      rows.push(rowData);
    });
  });
  await Promise.all(promises);
  return rows;
}

//  write to CSV
async function attachNumbers() {
  let results = [];
  let jsonResults = [];
  const filePath = process.env.FILE_OUTPUT;
  try {
    results = await functions.streamCsv(filePath);
  } catch (error) {
    console.log('unable to stream CSV: ', error);
  }
  try {
    jsonResults = await addNumbers(results);
  } catch (error) {
    console.log('unable to get json Results', error);
  }
  await functions.writeCSV(filePath, jsonResults);
}

attachNumbers();
