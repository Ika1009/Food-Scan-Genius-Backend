const axios = require('axios');
const fs = require('fs');

async function fetchAnalysis() {
    const latitude = 34.0522;
    const longitude = -118.2437;
    const userId = "test";
    const baseUrl = 'https://api.scangeni.us/';

    const headers = [
        'BarCodeNum', 'TimeStamp', 'OFF STATUS', 'UPC STATUS', 'EDAMAM STATUS', 'USDA STATUS', 'NUTRITIONIX STATUS',
        'Brands', 'Quantity', 'Categories', 'ProductName', 'ImageUrl',
        'celery', 'cereals_containing_gluten', 'crustaceans', 'eggs', 'fish',
        'lupin', 'milk', 'molluscs', 'mustard', 'nuts', 'peanuts', 'sesame_seeds',
        'soya_beans', 'sulphur_dioxide', 'Vegan', 'LactoVegetarian', 'OvoVegetarian',
        'LactoOvoVegetarian', 'Pescatarian', 'WhiteMeatOnly', 'RedMeatOnly', 'Halal',
        'Kosher', 'Beef', 'Jain', 'Onion', 'Keto', 'Paleo', 'Mediterranean',
        'SugarFree', 'Local', 'Organic', 'GeneticallyModified', 'FullyRecycled',
        'PartRecycled', 'ABCDERatings', 'HighSugarSaltSpecificProducts', 'CountryOfOrigin',
        'Fat', 'Iron', 'Salt', 'Fiber', 'Energy', 'Sodium', 'Sugars', 'Alcohol', 'Calcium',
        'Carbohydrates', 'Proteins', 'SaturatedFat', 'TransFat', 'VitaminA', 'VitaminC', 'Potassium',
        'Phosphorus', 'Ingredients', 'Ingredients_text'
    ];


    fs.writeFileSync('analysis.csv', headers.map(header => `"${header}"`).join(',') + '\n');

    const barcodes = fs.readFileSync('barcodes.txt', 'utf-8').split('\n');
    for (let i = 0; i < barcodes.length; i++) {
        const barcode = barcodes[i].trim();
        console.log("barcode: " + barcode)
        try {
            let response = await axios.get(baseUrl, {
                params: {
                    barcode: barcode,
                    latitude: latitude,
                    longitude: longitude,
                    userId: userId
                }
            });
            response = response.data;

            if (response.data.message) {
                const noProductFound = Array(headers.length).fill('No product found');
                noProductFound[0] = barcode; // Put the barcode in the first column
                fs.appendFileSync('analysis.csv', noProductFound.join(',') + '\n');
            } else {
                //console.log(response.data);
                const analysis = response.analysis;
                const additionalData = {
                    brands: response.data.brands || response.data.brand || response.data.brand_name,
                    quantity: response.data.quantity,
                    categories: response.data.categories || response.data.categorie || response.data.category,
                    productName: response.data.product_name || response.data.food_name || response.data.title || response.data.label,
                    imageUrl: response.data.image_url,
                    description: response.data.description,
                    apiStatus: response.data.apiStatus,
                    nutriments: response.data.nutriments, // Add this line
                    ingredients: Array.isArray(response.data.ingredients) ? response.data.ingredients.map(ingredient => ingredient.id).join(', ') : '',
                    ingredients_text: response.data.ingredients_text // Add this line
                };
                
                const flattenedAnalysis = flattenAnalysis(analysis, additionalData);
                fs.appendFileSync('analysis.csv', 
                flattenedAnalysis.join(',') + 
                `,"${additionalData.nutriments.fat || ''}","${additionalData.nutriments.iron || ''}","${additionalData.nutriments.salt || ''}","${additionalData.nutriments.fiber || ''}","${additionalData.nutriments.energy || ''}","${additionalData.nutriments.sodium || ''}","${additionalData.nutriments.sugars || ''}","${additionalData.nutriments.alcohol || ''}","${additionalData.nutriments.calcium || ''}","${additionalData.nutriments.carbohydrates || ''}","${additionalData.nutriments.proteins || ''}","${additionalData.nutriments['saturated-fat'] || ''}","${additionalData.nutriments['trans-fat'] || ''}","${additionalData.nutriments['vitamin-a'] || ''}","${additionalData.nutriments['vitamin-c'] || ''}","${additionalData.nutriments.potassium || ''}","${additionalData.nutriments.phosphorus || ''}","${additionalData.ingredients}","${additionalData.ingredients_text}"` + 
                '\n'
                );
                          }

            // Remove processed barcode from barcodes array and update the file
            barcodes.splice(i, 1);
            i--; // Adjust index because we removed an item
            fs.writeFileSync('barcodes.txt', barcodes.join('\n'));

        } catch (error) {
            console.error(`Error fetching data for barcode ${barcode}: `, error);

            // Append to log.txt file
            fs.appendFileSync('log.txt', `Error fetching data for barcode ${barcode}: ${error}\n`);
        }
    }
}

function flattenAnalysis(analysis, additionalData) {
    // Updated to include new data fields
    const flatAnalysis = [
        analysis.BarCodeNum,
        analysis.TimeStamp,
        ...Object.values(additionalData.apiStatus),
        additionalData.brands,
        additionalData.quantity,
        additionalData.categories,
        additionalData.productName,
        additionalData.imageUrl,
        ...Object.values(analysis.Allergens),
        ...Object.values(analysis.LifestyleChoices),
        ...Object.values(analysis.ReligiousRestrictions),
        ...Object.values(analysis.DietChoice),
        ...Object.values(analysis.SustainabilityChoices),
        ...Object.values(analysis.Packaging),
        ...Object.values(analysis.FoodRatings),
        analysis.CountryOfOrigin,
    ].map(field => `"${field}"`); // Wrap each field in quotes;
    return flatAnalysis;
}

function isEmpty(obj) {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

fetchAnalysis();