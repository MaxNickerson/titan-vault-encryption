// src/cognitoConfig.js
import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'us-east-1_OpoLtFku6', // Your User Pool ID
  ClientId: 'rlg1etqc0djs7lqfhp6drdm0d', // Your App Client ID
};

export default new CognitoUserPool(poolData);
