import { registerRootComponent } from 'expo'
import { Buffer } from 'buffer';
import 'react-native-get-random-values';

global.crypto.getRandomValues;
global.Buffer = Buffer;

import App from '@'

registerRootComponent(App)
