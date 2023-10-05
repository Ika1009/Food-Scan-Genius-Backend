import AWS from 'aws-sdk';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
    try {
        if (!event.queryStringParameters || !event.queryStringParameters.uid) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'UUID parameter is missing.' }),
            };
        }

        // Extract UUID and other parameters
        const { uid, ...updateFields } = event.queryStringParameters;

        // Update the user in the DynamoDB table
        await updateUserInDynamoDB(uid, updateFields);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'User updated successfully' }),
        };
    } catch (error) {
        console.error("Handler error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Handler error: " + error }),
        };
    }
};

async function updateUserInDynamoDB(uid, updateFields) {
    const updateExpr = Object.keys(updateFields).map((field, index) => `${field} = :val${index}`).join(', ');
    const exprAttrValues = Object.keys(updateFields).reduce((acc, field, index) => {
        acc[`:val${index}`] = updateFields[field];
        return acc;
    }, {});

    const params = {
        TableName: 'users',
        Key: {
            uid
        },
        UpdateExpression: `SET ${updateExpr}`,
        ExpressionAttributeValues: exprAttrValues,
        ReturnValues: "UPDATED_NEW"
    };

    try {
        await dynamoDb.update(params).promise();
        console.log(`User with UUID ${uid} has been updated in DynamoDB.`);
    } catch (error) {
        console.error("Error updating user in DynamoDB", error);
        throw error;
    }
}
