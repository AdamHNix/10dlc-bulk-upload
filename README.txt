# A2P 10DLC Registration Script

This script is designed to automate the process of registering A2P (Application-to-Person) 10DLC (10-Digit Long Code) messaging campaigns using the Twilio API. It streamlines the creation of secondary customer profiles, trust bundles, messaging services, campaigns, and more.

## Files

1. `Functions.js`: This file contains various functions that interact with the Twilio API to perform the necessary operations for A2P 10DLC registration. These functions are used throughout the script.

2. `script.js`: The main script file that orchestrates the A2P 10DLC registration process. It uses the functions from `Functions.js` to create, update, and manage A2P campaigns based on the data provided in a CSV file.

3. `rerun.js`: This script can be used to rerun the A2P campaign registration process on the existing data in the `newData.csv` file. It imports functions from both `Functions.js` and `script.js`.

4. `campaignStatus.js`: This script is used to update the status of A2P campaigns and write the results to a CSV file. It imports functions from `Functions.js`.

5. `attachNumbers.js`: This script is used to attach Twilio phone numbers to A2P campaigns. It imports functions from `Functions.js`.

6. `update.js`: This script is used to update customer profiles, trust hub profiles and brands. Make sure to run "rerun.js" after this to check the brand status and move on to campaign registration.

## Getting Started

1. Ensure you have Node.js installed on your system.

2. Install project dependencies by running the following command in your project directory:

    ```
    npm install
    ```

3. Set up your Twilio API credentials and other environment variables by creating a `.env` file in your project directory. Refer to the `dotenv` package documentation for details on configuring environment variables. Here are the items to configure:


TWILIO_ACCOUNT_SID
Found on your Twilio account. 

TWILIO_AUTH_TOKEN 
Found on your Twilio account.

FILE_PATH
Create an existing CSV and mark the path here with the brand and campaign details as shown here https://docs.google.com/spreadsheets/d/1vgV3Z-PMx3l-LkEMTySlVSo1ljqDcCix/edit#gid=1548984817

FILE_OUTPUT
Name of new CSV that will provide SIDs, brand Status, campaign status, and phone number allocation Status. Note that this will be overwritten when running any of the above files 

IS_MOCK
Set to true for testing in order to not be charged. Set to false when ready to register at production. Note that you will be charged for Brand and Campaign registration fees when this is marked as false.

PRIMARY_CUSTOMER_PROFILE
Set to Primary Customer Profile SID on Parent Twilio account

UPDATE_FILE
CSV used to make updates to any failed brands

UPDATE_FILE_OUTPUT="updateOutput.csv"
Name of new CSV post-update. This can then be moved to the "FILE_OUTPUT" csv and you can continue the registration process


4. Prepare your data in a CSV file. Make sure the CSV file follows the required format and includes all the necessary information for A2P campaign registration.

  - Note on subaccounts: If you would like to use subaccounts that already exist, simply add them under the subaccount column. If you want this script to create new subaccounts for you, leave this column blank. If you would prefer not to use subaccounts, add your parent account sid under the subaccounts column.

5. Run the script using one of the following commands, depending on your specific needs:

- To run the entire A2P 10DLC registration process, use:
  ```
  node script.js
  ```

- To rerun the campaign registration process on existing data, use:
  ```
  node rerun.js
  ```

- To update the status of A2P campaigns, use:
  ```
  node campaignStatus.js
  ```

- To attach Twilio phone numbers to campaigns, use:
  ```
  node attachNumbers.js
  ```

## Important Notes

- Review the code comments and documentation within the scripts for a better understanding of how each step of the A2P 10DLC registration process is automated.

- Be cautious when running these scripts, especially on production data, as they interact with your Twilio account and perform critical operations.

- Error handling is included in the scripts, but you should monitor the script execution for any unexpected issues.

- Errors will be logged to the error column in your CSV.

- Make sure to review the Twilio API documentation and any specific requirements related to A2P 10DLC registration to ensure compliance with regulations and guidelines.

- Whenever a script is ran, it will rewrite newData.csv with new information.

- If a campaign fails, remove it from the spreadsheet and run rerun.js again once you have updated the information

- This script only handles private entities. This is hard-coded.

- skipAutomatSecVet is hard coded to "True." If you want to register standard brands, you will need to adjust accordingly.

- New Messaging Services are set to default webhook property of "defer to sender's webhook." Ensure you add a URL to the TwilioPhoneUrl column if one is not set yet.

- The update script handles updates when you have already been charged $4 and have an external id (tcrId). You have three attempts to update. You will get an error on the 4th attempt.

- The update script cannot update customer profiles that are in-review or twilio-approved. Sometimes customer profiles get stuck in the "in-review" state. If this is the case, you will need to contact support to fix it.

- If there is no external brand ID (tcrId), you will be told to reregister from scratch.
