import * as functions from './Functions.js';

const fileOutput = process.env.FILE_OUTPUT;

//  rerun brand status check. If brand is registered, create messaging service and submit campaign
async function runCampaignScript() {
  let results = [];
  let jsonResults = [];
  try {
    results = await functions.streamCsv(fileOutput);
  } catch (error) {
    console.log('unable to stream CSV: ', error);
  }
  try {
    jsonResults = await functions.runCampaigns(results);
  } catch (error) {
    console.log('unable to get json Results', error);
  }
  await functions.writeCSV(fileOutput, jsonResults);
}

runCampaignScript();
