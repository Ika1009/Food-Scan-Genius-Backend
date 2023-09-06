const axios = require('axios');

const API_BASE_URL = 'https://api.nal.usda.gov/fdc'; // Replace with the correct base URL
const API_KEY = 'Your-API-Key-Here'

// Example usage:
getFoodByFdcId(534358, 'full', [203, 204, 205]).then(apiResponse => {
    const food = createFoodObject(apiResponse);
    console.log(food);
}).catch(error => {
    console.error('Error fetching data:', error);
});

async function getFoodByFdcId(fdcId, format = 'full', nutrients) {
    try {
        const response = await axios.get(`${API_BASE_URL}/v1/food/${fdcId}`, {
            headers: {
                'Authorization': API_KEY, // Replace with your API key
            },
            params: {
                format,
                nutrients,
            }
        });

        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Error fetching data:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}


function createFoodObject(apiResponse) {
    const food = {};

    // Properties common for all schemas
    food.fdcId = apiResponse.fdcId;
    food.dataType = apiResponse.dataType;
    food.description = apiResponse.description;

    // Conditional properties based on dataType
    switch (food.dataType) {
        case 'Branded':
            food.availableDate = apiResponse.availableDate;
            food.brandOwner = apiResponse.brandOwner;
            food.dataSource = apiResponse.dataSource;
            food.foodClass = apiResponse.foodClass;
            food.gtinUpc = apiResponse.gtinUpc;
            food.householdServingFullText = apiResponse.householdServingFullText;
            food.ingredients = apiResponse.ingredients;
            food.modifiedDate = apiResponse.modifiedDate;
            food.publicationDate = apiResponse.publicationDate;
            food.servingSize = apiResponse.servingSize;
            food.servingSizeUnit = apiResponse.servingSizeUnit;
            food.preparationStateCode = apiResponse.preparationStateCode;
            food.brandedFoodCategory = apiResponse.brandedFoodCategory;
            food.tradeChannel = apiResponse.tradeChannel;
            food.gpcClassCode = apiResponse.gpcClassCode;
            food.foodNutrients = apiResponse.foodNutrients;
            food.foodUpdateLog = apiResponse.foodUpdateLog;
            food.labelNutrients = apiResponse.labelNutrients;
            break;
        case 'Foundation':
            food.foodClass = apiResponse.foodClass;
            food.footNote = apiResponse.footNote;
            food.isHistoricalReference = apiResponse.isHistoricalReference;
            food.ndbNumber = apiResponse.ndbNumber;
            food.publicationDate = apiResponse.publicationDate;
            food.scientificName = apiResponse.scientificName;
            break;
        case 'SR Legacy':
            food.foodClass = apiResponse.foodClass;
            food.footNote = apiResponse.footNote;
            food.isHistoricalReference = apiResponse.isHistoricalReference;
            food.ndbNumber = apiResponse.ndbNumber;
            food.publicationDate = apiResponse.publicationDate;
            food.scientificName = apiResponse.scientificName;
            // Adjust this section if the properties of 'SR Legacy' differ from 'Foundation'
            break;
        case 'Survey (FNDDS)':
            food.startDate = apiResponse.startDate;
            food.endDate = apiResponse.endDate;
            food.foodClass = apiResponse.foodClass;
            food.footNote = apiResponse.footNote;
            food.isHistoricalReference = apiResponse.isHistoricalReference;
            food.publicationDate = apiResponse.publicationDate;
            food.scientificName = apiResponse.scientificName;
            // Add or adjust this section if the properties of 'Survey (FNDDS)' differ from the others
            break;
    }

    return food;
}
