// src/cognitoConfig.js
import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'us-east-1_ZSdwAA8FJ', // Your User Pool ID
  ClientId: '28bk3ok0246oodeorj8l5ikk6c', // Your App Client ID
};

export default new CognitoUserPool(poolData);
