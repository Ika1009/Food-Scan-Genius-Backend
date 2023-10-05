import AWS from 'aws-sdk';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
    try {
        // Extract email and password from the query string parameters
        if (!event.queryStringParameters || !event.queryStringParameters.email || !event.queryStringParameters.password) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Email and password parameters are missing.' }),
            };
        }

        const { email, password } = event.queryStringParameters;

        // Check if the user exists in DynamoDB
        const userData = await getUserFromDynamoDB(email, password);
        if (userData) {
            return {
                statusCode: 200,
                body: JSON.stringify(userData),
            };
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'User not found.' }),
            };
        }
    } catch (error) {
        console.error("Handler error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Handler error: " + error }),
        };
    }
};

async function getUserFromDynamoDB(email, password) {
    const params = {
        TableName: 'users',
        Key: {
            email: email,
        }
    };

    try {
        const result = await dynamoDb.get(params).promise();
        if (result.Item) {
            // You can add a more secure way to compare passwords in production.
            if (result.Item.password === password) {
                return result.Item;
            }
        }
        return null;
    } catch (error) {
        console.error("Error fetching data from DynamoDB", error);
        throw error;
    }
}
