const axios = require('axios');


//#region OPEN FOOD FACTS

const barcode = '3017624010701';  // Replace with your barcode

getProductByBarcode(barcode).then(response => {
    //console.log(response);
}).catch(error => {
    console.error('Error fetching product:', error);
});

async function getProductByBarcode(barcode) {
    const BASE_URL = 'https://world.openfoodfacts.net/api/v2/product/';

    try {
        const response = await axios.get(`${BASE_URL}${barcode}`);
        if (response.status === 200) {
            return response.data;
        } else {
            console.error('Error fetching data:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

//#endregion

//#region USDA API

//https://api.nal.usda.gov/fdc/v1/food/######?api_key=DEMO_KEY
const API_KEY_USDA = '1bQJHgcJvDKcnexDwE12u75KZAsbxH5ew2CIDdW9'

// Example usage:
/*USDA_getFoodByFdcId(534358, 'full').then(apiResponse => {
    console.log(apiResponse);
    const food = createFoodObject(apiResponse);
    console.log(food);
}).catch(error => {
    console.error('Error fetching data:', error);
});*/

async function USDA_getFoodByFdcId(fdcId, format = 'full', nutrients) {
    try {
        console.log(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${API_KEY_USDA}`);
        const response = await axios.get(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${API_KEY_USDA}`, {
            params: {
                format,
                nutrients,
            }
        });

        if (response.status === 200) {
            return response.data;
        } else {
            console.log('Error fetching data:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

//#endregion

//#region UPC
