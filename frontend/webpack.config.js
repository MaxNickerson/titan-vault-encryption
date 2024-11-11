const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './src/index.js', // Path to your main entry file
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/', // Ensures proper URL handling for routes
  },
  mode: 'development', // or 'production' for build
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'], // Loaders for CSS and Tailwind
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html', // Path to your HTML template
    }),
  ],
  devServer: {
    historyApiFallback: true, // Enable client-side routing support
    static: {
      directory: path.join(__dirname, 'public'), // Serve static files from "public" folder
    },
    port: 3000, // Port number for the dev server
    open: true, // Automatically opens the browser
  },
};
