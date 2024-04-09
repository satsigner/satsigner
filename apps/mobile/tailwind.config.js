export default {
  theme: {
    extend: {
      colors: {
        bitcoin: '#F7931A',
        ss: {
          transparent: 'transparent',
          current: 'currentColor',

          // Black and White
          white: '#FFFFFF',
          black: '#000000',

          // Gray
          gray: {
            25: '#F5F5F5',
            50: '#F0F0F0',
            75: '#CDCDCD',
            100: '#A0A0A0',
            200: '#828282',
            300: '#777777',
            400: '#686868',
            500: '#515151',
            600: '#434343',
            700: '#363636',
            800: '#2D2D2D',
            850: '#242424',
            900: '#1A1A1A',
            950: '#131313'
          },

          // Status
          success: '#07BC03',
          warning: '#FEFF5D',
          error: '#C13939',
          info: '#0AA4EB'
        }
      },
      fontFamily: {
        'sf-pro-text-light': ['SF Pro Text Light', 'sans-serif'],
        'sf-pro-text': ['SF Pro Text Regular', 'sans-serif'],
        'sf-pro-text-medium': ['SF Pro Text Medium', 'sans-serif'],
        'sf-pro-text-bold': ['SF Pro Text Bold', 'sans-serif']
      }
    }
  }
}
