import axios from 'axios';
import AWS from 'aws-sdk';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
    function isProductNotFound(data) {
        // Check if the only properties in data are nutriments, ingredients, analysis, and apiStatus
        const keys = Object.keys(data);
        if (keys.length !== 4) return false;
    
        // Check if nutriments, ingredients, and analysis are empty
        if (Object.keys(data.nutriments).length !== 0) return false;
        if (data.ingredients.length !== 0) return false;
    
        // If we reach here, it means data meets the criteria for "No product found"
        return true;
    }
    function isValidBarcode(barcode) {
        const regex = /^\d+$/;
        return regex.test(barcode);
    }
    try {          
        if (!event.queryStringParameters || !event.queryStringParameters.barcode) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Barcode parameter is missing.' }),
            };
        }

        const { barcode, latitude, longitude, userId } = event.queryStringParameters;
        console.log(`Parameters received - barcode: ${barcode}, latitude: ${latitude}, longitude: ${longitude}, userId: ${userId}`); // Log statement 3

        if (!barcode || !latitude || !longitude || !userId || !isValidBarcode(barcode)) {
            console.log("One or more required parameters are missing."); // Log statement 4
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required parameters or invalid format.' }),
            };
        }

        const timestamp = Date.now().toString();
        let timezone = getTimezone(latitude, longitude)[0];
        // Call the new function to upload data to the new table.
        await uploadToLogsTable(barcode, latitude, longitude, userId, timezone, timestamp);

        let response = await getFromDynamoDB(barcode);
        if (!response) {
            console.log("Doesn't exist in the dynamodb, uploading: ", response);
            const data = await fetchDataAndProcess(barcode);
            // Check if data meets "No product found" criteria
            if (isProductNotFound(data)) {
                response = JSON.stringify({
                    data: {
                        message: "No product found"
                    }
                });
                await uploadToDynamoDB(barcode, response);
                return;  // End execution if no product was found
            }
            const analysis = processApiResponseToLabels(data);
            analysis.TimeStamp = timestamp;
            analysis.BarCodeNum = barcode
            response = JSON.stringify({
                data: data,
                analysis: analysis
            });
            await uploadToDynamoDB(barcode, response);
        }
        else
            console.log("Already exists in the database");

        return {
            statusCode: 200,
            body: response
        };
    } 
    catch (error) {
        console.error("Handler error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Handler error: " + error}),
        };
    }
    
};

// Import the geo-tz library
import { find as geoTz } from 'geo-tz';

// Define a function to get timezone
function getTimezone(latitude, longitude) {
  // Use the find method from geo-tz to get the timezone
  const timezones = geoTz(latitude, longitude)
  if (timezones.length === 0) {
    return ["unknown"];
  }
  return timezones;
}

async function getFromDynamoDB(barcode) {
    const params = {
        TableName: "fsg",
        Key: {
            barcode: barcode
        }
    };

    try {
        const result = await dynamoDb.get(params).promise();
        return result.Item ? result.Item.response : null;
    } catch (error) {
        console.error("Error fetching data from DynamoDB", error);
        throw error;
    }
}


async function uploadToDynamoDB(barcode, response) {
    if (!barcode) {
        throw new Error("A valid barcode is required.");
    }

    const params = {
        TableName: "fsg",
        Item: {
            barcode: barcode, // Unique primary key
            response: response
        }
    };

    try {
        await dynamoDb.put(params).promise();
        console.log(`Data for barcode ${barcode} has been saved to DynamoDB.`);
    } catch (error) {
        console.error("Error saving data to DynamoDB", error);
        throw error;
    }
}

async function uploadToLogsTable(barcode, latitude, longitude, userId, timezone, timestamp) {
    if (!barcode || !latitude || !longitude || !userId || !timezone) {
        throw new Error("All parameters are required.");
    }

    // Getting the current timestamp.

    const params = {
        TableName: "logs", // Change this to your new table name
        Item: {
            userId: userId,
            timestamp: timestamp,
            barcode: barcode,
            latitude: latitude,
            longitude: longitude,
            timezone: timezone
        }
    };

    try {
        await dynamoDb.put(params).promise();
        console.log(`Data for barcode ${barcode} has been saved to the new table.`);
    } catch (error) {
        console.error("Error saving data to the new DynamoDB table", error);
        throw error;
    }
}

async function fetchDataAndProcess(barcode) {
    let data = {};
    data.nutriments = {};
    data.ingredients = [];
    data.apiStatus = {};

    // OPEN FOOD FACTS
    try {
        const response = await getProductByBarcode(barcode);
        if(response && response.product)
        {
            extractDataFromApiResponse(response.product, data);
            console.log("OPEN FOOD FACTS SUCCESS")
            data.apiStatus.openFoodFacts = 'SUCCESS'; // Mark as successful
        }
        else {
            data.apiStatus.openFoodFacts = 'ERROR: Unexpected Response'; // Mark as error
            console.error('Unexpected API response structure at Open Food Facts:', response);
        }
    } catch(error) {
        data.apiStatus.openFoodFacts = 'ERROR: Fetch Failed'; // Mark as error
        console.error('Error fetching product at OPEN FOOD FACTS:', error);
    }

    // UPC
    try {
        const upcResponse = await getProductByUPC(barcode);
        if(upcResponse)
        {
            mergeApiResponseWithExtractedData(upcResponse, data);
            console.log("UPC SUCCESS")
            data.apiStatus.upc = 'SUCCESS'; // Mark as successful
        }
        else 
        {
            data.apiStatus.upc = 'ERROR: Unexpected Response'; // Mark as error
            console.error('Unexpected API response structure at UPC:', upcResponse);
        }
    } catch(error) {
        data.apiStatus.upc = 'ERROR: Fetch Failed'; // Mark as error
        console.error('Error fetching product at UPC:', error);
    }

    // Edamam
    try {
        const edamamResponse = await getProductByEdamam(barcode);
        if(edamamResponse && edamamResponse.hints[0]) {
            mergeApiResponseWithEdamamData(edamamResponse.hints[0], data);
            console.log("EDAMAM SUCCESS");
            data.apiStatus.edamam = 'SUCCESS'; // Mark as successful
        } else {
            console.error('Unexpected API response structure at Edamam:', edamamResponse);
            data.apiStatus.edamam = 'ERROR: Unexpected Response'; // Mark as error
        }

    } catch(error) {
        console.error('Error fetching product at Edamam:', error);
        data.apiStatus.edamam = 'ERROR: No product found'; // Mark as error
    }

    //USDA
    try
    {
        let name = data.product_name;

        if(name) {
            const usdaResponse = await USDA_searchFoodByName(name);
            if(usdaResponse && usdaResponse.foods[0]) {
                mergeApiResponseWithUSDAData(usdaResponse.foods[0], data);
                console.log("USDA SUCCESS")
                data.apiStatus.usda = 'SUCCESS'; // Mark as successful
            } else {
                data.apiStatus.usda = 'ERROR: No product found'; // Mark as error
                console.error('No product found at USDA:', usdaResponse);
            }
        }
    } catch(error) {
        console.error('Error fetching product at USDA:', error);
        data.apiStatus.usda = 'ERROR: No product found'; // Mark as error
    }

    // Nutritionix
    try {
        const nutritionixResponse = await getProductByNutritionix(barcode);
        if (nutritionixResponse && nutritionixResponse.foods) {
            mergeApiResponseWithNutritionixData(nutritionixResponse, data);
            console.log("Nutritionix SUCCESS");
            data.apiStatus.nutritionix = 'SUCCESS'; // Mark as successful
        } else {
            console.error('Unexpected API response structure at Nutritionix:', nutritionixResponse);
            data.apiStatus.nutritionix = 'ERROR: Unexpected Response'; // Mark as error
        }
    } catch(error) {
        console.error('Error fetching data at Nutritionix:', error);
        data.apiStatus.nutritionix = 'ERROR: Fetch Failed'; // Mark as error
    }

    return data;
}


//#region OPEN FOOD FACTS
// Example: https://world.openfoodfacts.net/api/v2/product/3017624010701

async function getProductByBarcode(barcode) {
    const BASE_URL = 'https://world.openfoodfacts.net/api/v2/product/';

    try {
        const response = await axios.get(`${BASE_URL}${barcode}`, { timeout: 5000 });
        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Error fetching data at OPEN FOOD FACTS:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error at OPEN FOOD FACTS:', error.message);
    }
}

function extractDataFromApiResponse(apiResponse, data) {
    const nutrimentFields = [
        'fat', 'iron', 'salt', 'fiber', 'energy', 'sodium', 'sugars', 'alcohol', 'calcium', 
        'fat_unit', 'proteins', 'iron_unit', 'salt_unit', 'trans-fat', 'vitamin-a', 'vitamin-c', 
        'fiber_unit', 'iron_label', 'nova-group', 'energy_unit', 'sodium_unit', 'sugars_unit', 
        'alcohol_unit', 'calcium_unit', 'carbohydrates', 'proteins_unit', 'saturated-fat', 
        'energy_serving', 'potassium_100g', 'trans-fat_unit', 'vitamin-a_unit', 'vitamin-c_unit', 
        'alcohol_serving', 'energy-kcal', 'energy-kcal_unit', 'carbohydrates_unit', 'nutrition-score-fr', 
        'nutrition-score-uk', 'saturated-fat_unit', 'monounsaturated-fat_100g', 'polyunsaturated-fat_100g', 
        'nutrient_levels'
    ];
    

    const ingredientsFields = [
        'id', 'rank', 'text', 'vegan', 'vegetarian'
        // ... Note: Based on the given list, these are the ingredients fields.
    ];

    const topLevelFields = [
        'id', 'lc', 'rev', 'code', 'lang', 'brands', 'labels', 'states', 'stores', 'traces', 
        'creator', 'editors', 'origins', 'scans_n', 'sortkey', 'checkers', 'complete', 'quantity', 
        '_keywords', 'additives', 'allergens', 'countries', 'created_t', 'emb_codes', 'image_url', 
        'informers', 'languages', 'max_imgid', 'packaging', 'categories', 'codes_tags', 'correctors', 
        'update_key', 'additives_n', 'brands_tags', 'cities_tags', 'completed_t', 'ingredients', 'labels_tags', 
        'last_editor', 'states_tags', 'stores_tags', 'traces_tags', 'editors_tags', 'generic_name', 'last_image_t',
        'origins_tags', 'product_name', 'serving_size', 'checkers_tags', 'ecoscore_tags', 'ingredients_n', 'photographers',
        'pnns_groups_1', 'pnns_groups_2', 'additives_prev', 'additives_tags', 'allergens_tags', 'countries_tags', 
        'ecoscore_grade', 'emb_codes_orig', 'emb_codes_tags', 'informers_tags', 'languages_tags', 'packaging_tags',
        'unique_scans_n', 'additives_old_n', 'categories_tags', 'correctors_tags', 'expiration_date', 'generic_name_en',
        'image_front_url', 'image_small_url', 'image_thumb_url', 'languages_codes', 'last_modified_t', 'new_additives_n',
        'nutrient_levels', 'product_name_en', 'purchase_places', 'additives_prev_n', 'additives_tags_n', 'entry_dates_tags',
        'ingredients_tags', 'ingredients_text', 'labels_hierarchy', 'labels_prev_tags', 'last_modified_by', 'nutrition_grades',
        'serving_quantity', 'states_hierarchy', 'traces_hierarchy', 'ingredients_debug', 'labels_debug_tags', 'no_nutrition_data',
        'additives_old_tags', 'emb_codes_20141016', 'ingredients_n_tags', 'nutrition_data_per', 'nutrition_grade_fr', 
        'photographers_tags', 'pnns_groups_1_tags', 'pnns_groups_2_tags', 'additives_prev_tags', 'allergens_hierarchy',
        'countries_hierarchy', 'image_nutrition_url', 'ingredients_text_en', 'languages_hierarchy', 'additives_debug_tags',
        'categories_hierarchy', 'categories_prev_tags', 'image_front_smallURL', 'last_edit_dates_tags', 'manufacturing_places',
        'nutrient_levels_tags', 'purchase_places_tags', 'categories_debug_tags', 'image_front_thumb_url', 'image_ingredients_url',
        'ingredients_ids_debug', 'labels_prev_hierarchy', 'last_image_dates_tags', 'nutrition_grades_tags', 'nutrition_score_debug',
        'ingredients_text_debug', 'unknown_nutrients_tags', 'categories_prev_hierarchy', 'image_nutrition_small_url',
        'image_nutrition_thumb_url', 'interface_version_created', 'manufacturing_places_tags', 'interface_version_modified',
        'image_ingredients_small_url', 'image_ingredients_thumb_url', 'ingredients_from_palm_oil_n', 'ingredients_from_palm_oil_tags',
        'ingredients_text_with_allergens', 'ingredients_text_with_allergens_en', 'fruits-vegetables-nuts_100g_estimate',
        'ingredients_that_may_be_from_palm_oil_n', 'ingredients_that_may_be_from_palm_oil_tags', 'ingredients_from_or_that_may_be_from_palm_oil_n'
    ];
    

    const extractFields = (fields, source) => {
        let result = {};
        fields.forEach(field => {
            // Only add the field if it exists in the source
            // if (source.hasOwnProperty(field)) {
            //     // If the field ends with "_100g", remove that suffix
            //     let modifiedField = field.endsWith('_100g') ? field.substring(0, field.length - 5) : field;
            //     result[modifiedField] = source[field];
            // }
            result[field] = source[field] || null;
        });
        return result;
    }

    const extractIngredients = (fields, source) => {
        return source.map(ingredient => extractFields(fields, ingredient));
    }

    data.nutriments = extractFields(nutrimentFields, apiResponse.nutriments);
    data.ingredients = extractIngredients(ingredientsFields, apiResponse.ingredients);
    Object.assign(data, extractFields(topLevelFields, apiResponse));    
    
}

//#endregion

//#region UPC

async function getProductByUPC(barcode) {
    const BASE_URL = 'https://api.upcitemdb.com/prod/trial/lookup';

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                upc: barcode
            },
            timeout: 3000
        });

        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Error fetching data at UPC:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error at UPC:', error.message);
    }
}
function mergeApiResponseWithExtractedData(apiResponse, data) {
    // Fields from the UPC API response and their mappings to custom variable names
    const upcItemFieldMapping = {
        'ean': 'ean',  // Not found in topLevelFields
        'title': 'product_name',
        'upc': 'upc',  // Not found in topLevelFields
        'gtin': 'gtin',  // Not found in topLevelFields
        'elid': 'elid',  // Not found in topLevelFields
        'description': 'description',  // Not found in topLevelFields
        'brand': 'brands',
        'model': 'model',  // Not found in topLevelFields
        'color': 'color',  // Not found in topLevelFields
        'size': 'serving_size',
        'dimension': 'dimension',  // Not found in topLevelFields
        'weight': 'quantity',
        'category': 'categories',
        'currency': 'currency',  // Not found in topLevelFields
        'lowest_recorded_price': 'lowest_recorded_price',  // Not found in topLevelFields
        'highest_recorded_price': 'highest_recorded_price',  // Not found in topLevelFields
        'images': 'images',
        'offers': 'offers',  // Not found in topLevelFields
        'user_data': 'user_data'  // Not found in topLevelFields
    };


    const upcOfferFieldMapping = {
        'merchant': 'merchant',
        'domain': 'domain',
        'title': 'title',
        'currency': 'currency',
        'list_price': 'list_price',
        'price': 'price',
        'shipping': 'shipping',
        'condition': 'condition',
        'availability': 'availability',
        'link': 'link',
        'updated_t': 'updated_t'
    };

    // For simplicity, let's focus on the first item in the API response.
    const item = apiResponse.items[0];

    // Merge top-level fields from UPC API response if they're not in data
    for (const [originalField, customField] of Object.entries(upcItemFieldMapping)) {
        if (!data[customField] && item[originalField]) {
            data[customField] = item[originalField];
        }
    }

    // Check if the offers field exists in the UPC API response and merge accordingly
    if (item.offers) {
        data[upcItemFieldMapping['offers']] = item.offers.map(offer => {
            let offerData = {};
            for (const [originalField, customField] of Object.entries(upcOfferFieldMapping)) {
                if (offer[originalField]) {
                    offerData[customField] = offer[originalField];
                }
            }
            return offerData;
        });
    }
}



//#endregion

//#region Edamam

//Application ID: 89003ab9
//Application Keys: 89379976073355baf935fb83d57677f3

async function getProductByEdamam(barcode) {
    const BASE_URL = 'https://api.edamam.com/api/food-database/v2/parser';
    const APP_ID = '89003ab9';
    const APP_KEY = '89379976073355baf935fb83d57677f3';

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                app_id: APP_ID,
                app_key: APP_KEY,
                upc: barcode
            },
            timeout: 3000
        });

        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Error fetching data at Edamam:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error at Edamam:', error.message);
    }
}

function mergeApiResponseWithEdamamData(apiResponse, data) {
    const item = apiResponse.food;
    const nutrientMapping = {
        'calcium': 'CA',
        'carbohydrates': 'CHOCDF',
        'net-carbohydrates': 'CHOCDF.net',
        'cholesterol': 'CHOLE',
        'energy': 'ENERC_KCAL',
        'monounsaturated-fat': 'FAMS',
        'polyunsaturated-fat': 'FAPU',
        'saturated-fat': 'FASAT',
        'fat': 'FAT',
        'trans-fat': 'FATRN',
        'iron': 'FE',
        'fiber': 'FIBTG',
        'folic-acid': 'FOLAC',
        'folate-dfe': 'FOLDFE',
        'folate-food': 'FOLFD',
        'potassium': 'K',
        'magnesium': 'MG',
        'sodium': 'NA',
        'niacin': 'NIA',
        'phosphorus': 'P',
        'proteins': 'PROCNT',
        'riboflavin': 'RIBF',
        'sugars': 'SUGAR',
        'added-sugars': 'SUGAR.added',
        'sugar-alcohols': 'Sugar.alcohol',
        'thiamin': 'THIA',
        'vitamin-e': 'TOCPHA',
        'vitamin-a-rae': 'VITA_RAE',
        'vitamin-b12': 'VITB12',
        'vitamin-b6': 'VITB6A',
        'vitamin-c': 'VITC',
        'vitamin-d': 'VITD',
        'vitamin-k': 'VITK1',
        'water': 'WATER',
        'zinc': 'ZN'
    };
 
    // Iterate over the mapping and update data.
    for (let [extractedKey, edamamKey] of Object.entries(nutrientMapping)) {
        if (item.nutrients && (item.nutrients[edamamKey] !== undefined) && (data.nutriments[extractedKey] === null || data.nutriments[extractedKey] === undefined)) {
            data.nutriments[extractedKey] = item.nutrients[edamamKey] || 0; 
        }
    }
    
    const directFieldMapping = {
        'foodId': 'foodId',  // Not found in topLevelFields
        'label': 'product_name',
        'knownAs': 'knownAs',  // Not found in topLevelFields
        'brand': 'brands',
        'category': 'categories',
        'categoryLabel': 'categoryLabel',  // Not found in topLevelFields
        'foodContentsLabel': 'foodContentsLabel',
        'image': 'image_url',
        'servingsPerContainer': 'servingsPerContainer'
    };


    for (const [originalField, customField] of Object.entries(directFieldMapping)) {
        if (!data[customField] && item[originalField]) {
            data[customField] = item[originalField];
        }
    }


    // Handling servingSizes
    // if (!data.servingSizes && item.servingSizes) {
    //     data.servingSizes = item.servingSizes.map(serving => ({
    //         uri: serving.uri,
    //         label: serving.label,
    //         quantity: serving.quantity
    //     }));
    // }

    // Handling measures from the API response
    // if (!data.measures && apiResponse.measures) {
    //     data.measures = apiResponse.measures.map(measure => ({
    //         uri: measure.uri,
    //         label: measure.label,
    //         weight: measure.weight
    //     }));
    // }
}

//#endregion

//#region USDA API

const API_KEY_USDA = '1bQJHgcJvDKcnexDwE12u75KZAsbxH5ew2CIDdW9';

async function USDA_searchFoodByName(query, pageSize = 50, pageNumber = 1) {
    const endpoint = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${pageSize}&pageNumber=${pageNumber}&api_key=${API_KEY_USDA}`;

    try {
        const response = await axios.get(endpoint, {
            headers: {
                'accept': 'application/json'
            },
            timeout: 3000
        });

        if (response.status === 200) {
            return response.data;
        } else {
            console.log('Error fetching data at USDA:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error at USDA:', error.message);
    }
}

function mergeApiResponseWithUSDAData(apiResponse, data) {
    const item = apiResponse;

    // If nutrients field does not exist in data, initialize it.
    if (!data.nutriments) {
        data.nutriments = {};
    }

    const nutrientMapping = {
        'calcium': 'calcium',
        'carbohydrates': 'carbohydrates',
        'cholesterol': 'cholesterol',
        'fat': 'fat',
        'trans-fat': 'transFat',
        'iron': 'iron',
        'fiber': 'fiber',
        'potassium': 'potassium',
        'sodium': 'sodium',
        'sugars': 'sugars',
        'protein': 'protein',
        'calories': 'calories',
        'saturated-fat': 'saturatedFat'
    };
    
    // Iterate over the mapping and update data.
    for (let [extractedKey, usdaKey] of Object.entries(nutrientMapping)) {
        if (item.labelNutrients && item.labelNutrients[usdaKey] && item.labelNutrients[usdaKey].value !== undefined && (data.nutriments[extractedKey] === null || data.nutriments[extractedKey] === undefined)) {
            data.nutriments[extractedKey] = item.labelNutrients[usdaKey].value || 0; 
        }
    }
    
const directFieldsMapping = {
    'fdcid': 'id',  // Assuming 'fdcid' is the unique identifier like 'id'
    'gtinUpc': 'gtinUpc',  // Not found in topLevelFields
    'dataType': 'dataType',  // Not found in topLevelFields
    'foodClass': 'foodClass',  // Not found in topLevelFields
    'brandOwner': 'brands',  // Assuming 'brandOwner' refers to 'brands'
    'dataSource': 'dataSource',  // Not found in topLevelFields
    'description': 'generic_name',  // Assuming 'description' might be like 'generic_name'
    'ingredients': 'ingredients',
    'servingSize': 'serving_size',
    'servingSizeUnit': 'servingSizeUnit',  // Not found in topLevelFields
    'discontinuedDate': 'expiration_date',  // Assuming 'discontinuedDate' is like 'expiration_date'
    'brandedFoodCategory': 'categories',
    'householdServingFullText': 'serving_quantity'  // Assuming this refers to the serving quantity
};

    directFields.forEach(field => {
        const mappedField = directFieldsMapping[field]; // Get the mapped field name
        if (mappedField && !data[mappedField] && item[field]) {
            data[mappedField] = item[field];
        }
    });

}


//#endregion

//#region Nutritionix

const NUTRITIONIX_APP_ID = '918f9c08';
const NUTRITIONIX_API_KEY = '3b8384ce0ff9e531b1d812f72c675b6c';  // You provided two API keys; I'm using the first one here

async function getProductByNutritionix(barcode) {
    const BASE_URL = 'https://trackapi.nutritionix.com/v2/search/item';
    try {
        const response = await axios.get(BASE_URL, {
            headers: {
                'x-app-id': NUTRITIONIX_APP_ID,
                'x-app-key': NUTRITIONIX_API_KEY
            },
            params: {
                upc: barcode
            },
            timeout: 3000
        });

        if (response.status === 200 && response.data && Array.isArray(response.data.foods)) {
            return response.data;
        } else {
            console.error('Error fetching data from Nutritionix or unexpected structure:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error at Nutritionix:', error.message);
    }
}

function mergeApiResponseWithNutritionixData(apiResponse, data) {
    if (!apiResponse || !Array.isArray(apiResponse.foods) || apiResponse.foods.length === 0) {
        console.warn('mergeApiResponseWithNutritionixData called with invalid apiResponse:', apiResponse);
        return;  // Exit early if the response isn't as expected
    }

    const item = apiResponse.foods[0];

    // If nutrients field does not exist in data, initialize it.
    if (!data.nutriments) {
        data.nutriments = {};
    }

    const nutrientMapping = {
        'calories': 'nf_calories',
        'total_fat': 'nf_total_fat',
        'saturated_fat': 'nf_saturated_fat',
        'cholesterol': 'nf_cholesterol',
        'sodium': 'nf_sodium',
        'total_carbohydrate': 'nf_total_carbohydrate',
        'dietary_fiber': 'nf_dietary_fiber',
        'sugars': 'nf_sugars',
        'protein': 'nf_protein',
        'potassium': 'nf_potassium',
        'phosphorus': 'nf_p'
        // ... Add other nutrient mappings as needed
    };
    
    // Iterate over the mapping and update data.
    for (let [extractedKey, nutritionixKey] of Object.entries(nutrientMapping)) {
        if (item && (item[nutritionixKey] !== undefined) && (data.nutriments[extractedKey] === null || data.nutriments[extractedKey] === undefined)) {
            data.nutriments[extractedKey] = item[nutritionixKey] || 0; 
        }
    }

    // Directly mapped fields with their custom names
    const directFieldMapping = {
        'fdcid': 'fdcid',
        'gtinUpc': 'gtinUpc',
        'dataType': 'dataType',
        'foodClass': 'foodClass',
        'brandOwner': 'brandOwner',
        'dataSource': 'dataSource',
        'description': 'description',
        'ingredients': 'ingredients',
        'servingSize': 'servingSize',
        'servingSizeUnit': 'servingSizeUnit',
        'discontinuedDate': 'discontinuedDate',
        'brandedFoodCategory': 'brandedFoodCategory',
        'householdServingFullText': 'householdServingFullText'
    };

    for (const [originalField, customField] of Object.entries(directFieldMapping)) {
        if (!data[customField] && item[originalField]) {
            data[customField] = item[originalField];
        }
    }


}


//#endregion



function processApiResponseToLabels(productData) {
    if (!productData) {
        throw new Error("Response data is missing.");
    }

    const containsTag = (tagArray, keyword) => tagArray && tagArray.some(tag => tag.includes(keyword)) ? 'Yes' : 'No';
    const containsKeyword = (keywords, keyword) => keywords && keywords.includes(keyword) ? 'Yes' : 'No';
    const containsIngredient = (ingredients, keyword) => ingredients && ingredients.some(ing => ing.text.toLowerCase().includes(keyword));
    const checkTraces = (tracesArray, keyword) => tracesArray && tracesArray.includes(keyword) ? 'Traces' : 'No';

    const hasBeef = containsIngredient(productData.ingredients, 'beef');
    const hasPork = containsIngredient(productData.ingredients, 'pork');
    const hasChicken = containsIngredient(productData.ingredients, 'chicken');
    const hasMilk = containsIngredient(productData.ingredients, 'milk');
    const hasEgg = containsIngredient(productData.ingredients, 'egg');
    const hasOnion = containsIngredient(productData.ingredients, 'onion');
    const hasGarlic = containsIngredient(productData.ingredients, 'garlic');
    const hasAnimalProducts = hasBeef || hasPork || hasChicken || hasMilk || hasEgg;
    const hasMeat = hasBeef || hasPork || hasChicken;
    const hasFish = containsIngredient(productData.ingredients, 'fish');
    const hasRedMeat = hasBeef || hasPork;
    
    // Define a function to check for multiple keywords
    const checkAllSources = (tagArray, ingredientArray, traceArray, keywords) => {
        const checkTag = tagArray && tagArray.some(tag => keywords.some(keyword => tag.includes(keyword)));
        const checkIngredient = ingredientArray && ingredientArray.some(ing => keywords.some(keyword => ing.text.toLowerCase().includes(keyword)));
        const checkTrace = traceArray && traceArray.some(trace => keywords.some(keyword => trace.includes(keyword)));

        if (checkTag) return 'Yes';
        if (checkIngredient) return 'Yes';
        if (checkTrace) return 'Traces';
        return 'No';
    };

    const result = {
        BarCodeNum: productData.code || productData.ean,
        TimeStamp: productData.last_modified_t,
        Allergens: {
            celery: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['celery']),
            cereals_containing_gluten: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['cereals-containing-gluten', 'wheat', 'rye', 'barley', 'oats']),
            crustaceans: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['crustaceans', 'prawns', 'crab', 'lobster']),
            eggs: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['eggs', 'egg']),
            fish: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['fish']),
            lupin: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['lupin']),
            milk: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['milk']),
            molluscs: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['molluscs', 'squid', 'mussels', 'cockles', 'whelks', 'snails']),
            mustard: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['mustard']),
            nuts: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['nuts']),
            peanuts: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['peanuts']),
            sesame_seeds: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['sesame-seeds', 'sesame']),
            soya_beans: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['soya-beans', 'soya']),
            sulphur_dioxide: checkAllSources(productData.allergens_tags, productData.ingredients, productData.traces_tags, ['sulphur-dioxide', 'sulphur', 'sulphites'])
        },
        LifestyleChoices: {
            Vegan: !hasAnimalProducts && productData.ingredients && productData.ingredients.every(i => i.vegan === 'yes') ? 'Yes' : 'No',
            LactoVegetarian: hasMilk && !hasMeat && !hasFish ? 'Yes' : 'No',
            OvoVegetarian: hasEgg && !hasMeat && !hasFish ? 'Yes' : 'No',
            LactoOvoVegetarian: (hasMilk || hasEgg) && !hasMeat && !hasFish ? 'Yes' : 'No',
            Pescatarian: hasFish && !hasMeat ? 'Yes' : 'No',
            WhiteMeatOnly: hasChicken && !hasRedMeat ? 'Yes' : 'No',
            RedMeatOnly: hasRedMeat && !hasChicken ? 'Yes' : 'No',
        },
        ReligiousRestrictions: {
            Halal: hasPork ? 'No' : (hasBeef || hasChicken ? 'Check Certification' : 'Yes'),
            Kosher: containsTag(productData.labels_tags, 'kosher') || 'Unknown',
            Beef: hasBeef ? 'Yes' : 'No',
            Jain: hasOnion || hasGarlic ? 'No' : 'Yes',
            Onion: hasOnion ? 'Yes' : 'No',
        },
        DietChoice: {
            Keto: containsKeyword(productData._keywords, 'keto'),
            Paleo: containsKeyword(productData._keywords, 'paleo'),
            Mediterranean: containsKeyword(productData._keywords, 'mediterranean'),
            SugarFree: containsKeyword(productData._keywords, 'sugar-free')
        },
        SustainabilityChoices: {
            Local: containsTag(productData.labels_tags, 'local'),
            Organic: containsTag(productData.labels_tags, 'organic'),
            GeneticallyModified: containsTag(productData.labels_tags, 'gmo')
        },
        Packaging: {
            FullyRecycled: containsTag(productData.packaging_tags, 'fully-recycled'),
            PartRecycled: containsTag(productData.packaging_tags, 'part-recycled')
        },
        FoodRatings: {
            ABCDERatings: productData.nutrition_grades || 'Unknown',
            HighSugarSaltSpecificProducts: productData.nutrient_levels && (productData.nutrient_levels.sugars === 'high' || productData.nutrient_levels.salt === 'high') ? 'Yes' : 'No'
        },
        CountryOfOrigin: (productData.origins_tags && productData.origins_tags[0]) || 'Unknown'
    };

    return result;
}


