// src/cognitoConfig.js
import { CognitoUserPool } from 'amazon-cognito-identity-js';

const poolData = {
  UserPoolId: 'us-east-2_AHUR8jFXp', // Your User Pool ID
  ClientId: '46p0geaa8fbrnjl03ja7mrrpqu', // Your App Client ID
};

export default new CognitoUserPool(poolData);
