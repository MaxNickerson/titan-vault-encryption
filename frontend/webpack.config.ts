import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import webpack from 'webpack';
import dotenv from 'dotenv';

// Load env variables from .env file
dotenv.config();

const config: webpack.Configuration = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
  },
  mode: 'production', // change to "development" if testing locally
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: 'ts-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json'],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new webpack.DefinePlugin({
      'process.env.REACT_APP_API_BASE': JSON.stringify(process.env.REACT_APP_API_BASE),
      'process.env.REACT_APP_COGNITO_USER_POOL_ID': JSON.stringify(process.env.REACT_APP_COGNITO_USER_POOL_ID || ''),
      'process.env.REACT_APP_COGNITO_APP_CLIENT_ID': JSON.stringify(process.env.REACT_APP_COGNITO_APP_CLIENT_ID || ''),
    }),
  ],
};

export default config;
