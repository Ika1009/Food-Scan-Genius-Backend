import AWS from 'aws-sdk';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

// Function to generate UUID v4
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (Math.random() * 16) | 0,
            v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export const handler = async (event) => {
    try {
        if (!event.queryStringParameters || !event.queryStringParameters.email || !event.queryStringParameters.display_name || !event.queryStringParameters.phone_number) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required parameters.' }),
            };
        }

        // Extract parameters
        const queryParams = event.queryStringParameters;

        // Generate a unique user identifier (UUID)
        const uid = uuidv4();

        // Save the user to the DynamoDB table
        await saveUserToDynamoDB(uid, queryParams);

        return {
            statusCode: 201,
            body: JSON.stringify({ uid, email: queryParams.email, display_name: queryParams.display_name }),
        };
    } catch (error) {
        console.error("Handler error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Handler error: " + error }),
        };
    }
};

async function saveUserToDynamoDB(uid, queryParams) {
    const params = {
        TableName: 'users',
        Item: {
            uid,
            ...queryParams,
        }
    };

    try {
        await dynamoDb.put(params).promise();
        console.log(`User with email ${queryParams.email} has been saved to DynamoDB.`);
    } catch (error) {
        console.error("Error saving user to DynamoDB", error);
        throw error;
    }
}
