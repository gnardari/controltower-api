import config from '../config-sample';
import ApiBuilder from 'claudia-api-builder';
import AWS from 'aws-sdk';
import uuid from 'node-uuid';
import { getFbUser } from './facebook';
import { getCustomer, findCustomersByFacebookId, createCustomer } from './dynamodb';
import { noAuthorizationHeaderError, existingFacebookIdError } from './errors';

const api = new ApiBuilder();
const dynamo = new AWS.DynamoDB.DocumentClient();

const FB_APP_SECRET = config.facebook.appSecret;

// extract acess token from request header
const getAccessToken = req => {
    if (!req.normalizedHeaders.authorization) {
        throw noAuthorizationHeaderError;
    }
    return req.normalizedHeaders.authorization.slice('Bearer '.length);
};

// check if the acessToken is a valid Facebook token for the correct
// Facebook app and if so, return a Facebook user object
const auth = token => getFbUser(FB_APP_SECRET, token);

// Create a customer
api.post('/v1/customers', req =>
    auth(getAccessToken(req)).then(fbUser =>
        findCustomersByFacebookId(dynamo, fbUser.id).then(data => {
            if (data.Count > 0) {
                throw JSON.stringify(
                    existingFacebookIdError(fbUser.id, data.Items[0].id)
                );
            }
            return createCustomer(dynamo, fbUser.id, fbUser.name, fbUser.email);
        })
), {
    success: { code: 201 },
    error: { contentType: 'text/plain' }
});

// Get customer info
api.get('/v1/customers/{customerId}', req => {
    const customerId = req.pathParams.customerId;
    return auth(getAccessToken(req)).then(() =>
        getCustomer(dynamo, customerId));
});

// Create a bot
api.post('/v1/bots', req => {
    console.log('request.pathParams', JSON.stringify(req.pathParams));
    console.log('req.body', req.body);

    const customerId = req.body.customerId;
    // TODO: check if customerId already existis in data table

    const id = uuid.v4();
    const params = {
        TableName: 'ct_bots',
        Item: {
            id,
            customerId
        }
    };
    return dynamo.put(params).promise()
        .then(() => id);
}, {
    success: { code: 201 }
});

// Get bot config
api.get('/v1/bots/{botId}', req => {
    console.log('request.pathParams', JSON.stringify(req.pathParams));
    console.log('req.body', req.body);
    const botId = req.pathParams.botId;
    return botId;
});

export default api;
