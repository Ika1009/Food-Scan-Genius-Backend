import AWS from 'aws-sdk';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
    try {
        if (!event.queryStringParameters || !event.queryStringParameters.uuid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'UUID parameter is missing.' }),
            };
        }

        const { uuid } = event.queryStringParameters;

        // Fetch the user history from DynamoDB
        const historyItems = await getUserHistoryFromDynamoDB(uuid);

        return {
            statusCode: 200,
            body: JSON.stringify({ history: historyItems }),
        };
    } catch (error) {
        console.error("Handler error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Handler error: " + error }),
        };
    }
};

async function getUserHistoryFromDynamoDB(uuid) {
    const params = {
        TableName: 'history',
        KeyConditionExpression: 'uuid = :uuidVal',
        ExpressionAttributeValues: {
            ':uuidVal': uuid
        }
    };

    try {
        const result = await dynamoDb.query(params).promise();
        return result.Items;
    } catch (error) {
        console.error("Error fetching history from DynamoDB", error);
        throw error;
    }
}
