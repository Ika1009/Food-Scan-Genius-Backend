const axios = require('axios');
const barcode = '3017624010701';  // Replace with your barcode
var name = "";
let data = {};

fetchDataAndProcess(barcode);

async function fetchDataAndProcess(barcode) {
    // OPEN FOOD FACTS
    try {
        const response = await getProductByBarcode(barcode);
        if(response && response.product)
            extractDataFromApiResponse(response.product);
        else {
            console.error('Unexpected API response structure at Open Food Facts:', nutritionixResponse);
        }
    } catch(error) {
        console.error('Error fetching product at OPEN FOOD FACTS:', error);
    }

    // UPC
    try {
        const upcResponse = await getProductByUPC(barcode);
        if(upcResponse)
            mergeApiResponseWithExtractedData(upcResponse);
        else 
            console.error('Unexpected API response structure at UPC:', nutritionixResponse);
    } catch(error) {
        console.error('Error fetching product at UPC:', error);
    }

    // Edamam
    try {
        const edamamResponse = await getProductByEdamam(barcode);
        if(edamamResponse && edamamResponse.hints[0]) {
            mergeApiResponseWithEdamamData(edamamResponse.hints[0]);
        } else {
            console.error('Unexpected API response structure at Edamam:', nutritionixResponse);
        }

        let name = data.knownAs;
        if (!name || name.trim() === "") {
            name = data.label;
        }
        if (!name || name.trim() === "") {
            name = object.product_name;
        }

        if(name && name.trim() !== "") {
            const usdaResponse = await USDA_searchFoodByName(name);
            if(usdaResponse && usdaResponse.foods[0]) {
                mergeApiResponseWithUSDAData(usdaResponse.foods[0]);
            } else {
                console.error('Unexpected API response structure at USDA:', nutritionixResponse);
            }
        }
    } catch(error) {
        console.error('Error fetching product at Edamam or USDA:', error);
    }

    // Nutritionix
    try {
        const nutritionixResponse = await getProductByNutritionix(barcode);
        if (nutritionixResponse && nutritionixResponse.foods) {
            mergeApiResponseWithNutritionixData(nutritionixResponse);
        } else {
            console.error('Unexpected API response structure at Nutritionix:', nutritionixResponse);
        }
    } catch(error) {
        console.error('Error fetching data at Nutritionix:', error);
    }

    // Finally, print out the data
    console.log(data);
}


//#region OPEN FOOD FACTS
// Example: https://world.openfoodfacts.net/api/v2/product/3017624010701

async function getProductByBarcode(barcode) {
    const BASE_URL = 'https://world.openfoodfacts.net/api/v2/product/';

    try {
        const response = await axios.get(`${BASE_URL}${barcode}`);
        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Error fetching data at OPEN FOOD FACTS:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error at OPEN FOOD FACTS:', error.message);
    }
}

function extractDataFromApiResponse(apiResponse) {
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
            if (source.hasOwnProperty(field)) {
                // If the field ends with "_100g", remove that suffix
                let modifiedField = field.endsWith('_100g') ? field.substring(0, field.length - 5) : field;
                result[modifiedField] = source[field];
            }
            //result[field] = source[field] || null;
        });
        return result;
    }

    const extractIngredients = (fields, source) => {
        return source.map(ingredient => extractFields(fields, ingredient));
    }

    data = {
        nutriments: extractFields(nutrimentFields, apiResponse.nutriments),
        ingredients: extractIngredients(ingredientsFields, apiResponse.ingredients),
        ...extractFields(topLevelFields, apiResponse)
    };
}

//#endregion

//#region UPC

async function getProductByUPC(barcode) {
    const BASE_URL = 'https://api.upcitemdb.com/prod/trial/lookup';

    try {
        const response = await axios.get(BASE_URL, {
            params: {
                upc: barcode
            }
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

function mergeApiResponseWithExtractedData(apiResponse) {
    // Fields from the UPC API response
    const upcItemFields = [
        'ean', 'title', 'upc', 'gtin', 'elid', 'description', 'brand', 'model', 'color', 
        'size', 'dimension', 'weight', 'category', 'currency', 'lowest_recorded_price', 
        'highest_recorded_price', 'images', 'offers', 'user_data'
    ];

    const upcOfferFields = [
        'merchant', 'domain', 'title', 'currency', 'list_price', 'price', 'shipping', 
        'condition', 'availability', 'link', 'updated_t'
    ];

    // For simplicity, let's focus on the first item in the API response.
    const item = apiResponse.items[0];

    // Merge top-level fields from UPC API response if they're not in data
    upcItemFields.forEach(field => {
        if (!data[field] && item[field]) {
            data[field] = item[field];
        }
    });

    // Check if the offers field exists in the UPC API response and merge accordingly
    if (item.offers) {
        data.offers = item.offers.map(offer => {
            let offerData = {};
            upcOfferFields.forEach(field => {
                if (offer[field]) {
                    offerData[field] = offer[field];
                }
            });
            return offerData;
        });
    }
    return data;
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
            }
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

function mergeApiResponseWithEdamamData(apiResponse) {
    const item = apiResponse.food;
    // If nutrients field does not exist in data, initialize it.
    if (!data.nutriments) {
        data.nutriments = {};
    }
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
    
    

    // Directly mapped fields
    const directFields = [
        'foodId', 'label', 'knownAs', 'brand', 'category', 
        'categoryLabel', 'foodContentsLabel', 'image', 'servingsPerContainer'
    ];

    directFields.forEach(field => {
        if (!data[field] && item[field]) {
            data[field] = item[field];
        }
    });

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
            }
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

function mergeApiResponseWithUSDAData(apiResponse) {
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
    
    // Directly mapped fields
    const directFields = [
        'fdcid', 'gtinUpc', 'dataType', 'foodClass', 'brandOwner', 
        'dataSource', 'description', 'ingredients', 'servingSize', 
        'servingSizeUnit', 'discontinuedDate', 'brandedFoodCategory', 
        'householdServingFullText'
    ];

    directFields.forEach(field => {
        if (!data[field] && item[field]) {
            data[field] = item[field];
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
            }
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

function mergeApiResponseWithNutritionixData(apiResponse) {
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

    // Directly mapped fields
    const directFields = {
        'food_name': 'food_name',
        'brand_name': 'brand_name',
        'serving_qty': 'serving_qty',
        'serving_unit': 'serving_unit',
        'serving_weight_grams': 'serving_weight_grams',
        'nix_brand_name': 'nix_brand_name',
        'nix_brand_id': 'nix_brand_id',
        'nix_item_name': 'nix_item_name',
        'nix_item_id': 'nix_item_id',
        'thumb': 'photo.thumb'
        // ... Add other fields as needed
    };

    for (let [dataKey, nutritionixKey] of Object.entries(directFields)) {
        if (!data[dataKey] && item[nutritionixKey]) {
            data[dataKey] = item[nutritionixKey];
        }
    }

}


//#endregion












// function processApiResponseToLabels(data) {
//     const productData = data.product;

//     if (!productData) {
//         throw new Error("Product data not found in the response.");
//     }
//     const result = {
//         BarCodeNum: productData.code || data.code,
//         TimeStamp: productData.last_modified_t,
//         ErrorCode: "No",
//         Allergens: {
//             celery: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('celery')) ? 'Yes' : 'No',
//             cereals_containing_gluten: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('cereals-containing-gluten')) ? 'Yes' : 'No',
//             crustaceans: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('crustaceans')) ? 'Yes' : 'No',
//             eggs: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('eggs')) ? 'Yes' : 'No',
//             fish: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('fish')) ? 'Yes' : 'No',
//             lupin: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('lupin')) ? 'Yes' : 'No',
//             milk: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('milk')) ? 'Yes' : 'No',
//             molluscs: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('molluscs')) ? 'Yes' : 'No',
//             mustard: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('mustard')) ? 'Yes' : 'No',
//             nuts: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('nuts')) ? 'Yes' : 'No',
//             peanuts: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('peanuts')) ? 'Yes' : 'No',
//             sesame_seeds: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('sesame-seeds')) ? 'Yes' : 'No',
//             soya_beans: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('soya-beans')) ? 'Yes' : 'No',
//             sulphur_dioxide: productData.allergens_tags && productData.allergens_tags.some(tag => tag.includes('sulphur-dioxide')) ? 'Yes' : 'No'
//         },
//         LifestyleChoices: {
//         Vegan: productData.ingredients && productData.ingredients.every(i => i.vegan === 'Yes') ? 'Yes' : 'No',
//             LactoVegetarian: 'No',  // This might need a more detailed logic to derive.
//             OvoVegetarian: 'No',  // This might need a more detailed logic to derive.
//             // And similarly for the other lifestyle choices
//         },
//         ReligiousRestrictions: {
//             Halal: productData.labels_tags && productData.labels_tags.includes('halal') ? 'Yes' : 'No',
//             Kosher: productData.labels_tags && productData.labels_tags.includes('kosher') ? 'Yes' : 'No',
//             Beef: 'Unknown', // This might need a more detailed logic to derive.
//             Jain: 'Unknown', // This might need a more detailed logic to derive.
//             Onion: 'Unknown', // This might need a more detailed logic to derive.
//         },
//         DietChoice: {
//             Keto: productData._keywords && productData._keywords.includes('keto') ? 'Yes' : 'No',
//             Paleo: productData._keywords && productData._keywords.includes('paleo') ? 'Yes' : 'No',
//             Mediterranean: productData._keywords && productData._keywords.includes('mediterranean') ? 'Yes' : 'No',
//             SugarFree: productData._keywords && productData._keywords.includes('sugar-free') ? 'Yes' : 'No'
//         },
//         SustainabilityChoices: {
//             Local: productData.labels_tags && productData.labels_tags.includes('local') ? 'Yes' : 'No',
//             Organic: productData.labels_tags && productData.labels_tags.includes('organic') ? 'Yes' : 'No',
//             GeneticallyModified: productData.labels_tags && productData.labels_tags.includes('gmo') ? 'Yes' : 'No'
//         },
//         Packaging: {
//             FullyRecycled: productData.packaging_tags && productData.packaging_tags.includes('fully-recycled') ? 'Yes' : 'No',
//             PartRecycled: productData.packaging_tags && productData.packaging_tags.includes('part-recycled') ? 'Yes' : 'No'
//         },
//         FoodRatings: {
//             ABCDERatings: productData.nutrition_grades || 'Unknown',
//             HighSugarSaltSpecificProducts: productData.nutrient_levels && (productData.nutrient_levels.sugars === 'high' || productData.nutrient_levels.salt === 'high') ? 'Yes' : 'No'
//         },
//         CountryOfOrigin: (productData.origins_tags && productData.origins_tags[0]) || 'Unknown'
//     };

//     return result;
// }
