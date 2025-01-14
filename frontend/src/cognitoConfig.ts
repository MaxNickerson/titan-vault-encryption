// src/cognitoConfig.js
import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'us-east-1_aUI9cggHC', // Your User Pool ID
  ClientId: '388csd4c9tak6vlgtr7rgq8euq', // Your App Client ID
};

export default new CognitoUserPool(poolData);
