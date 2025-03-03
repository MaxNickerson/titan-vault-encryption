// src/cognitoConfig.js
import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  // Keep HEAD’s new IDs:
  UserPoolId: 'us-east-1_ZSdwAA8FJ',
  ClientId: '28bk3ok0246oodeorj8l5ikk6c',
};

export default new CognitoUserPool(poolData);
