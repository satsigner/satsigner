import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { NavigationProp } from '@react-navigation/native';

import { Colors } from '../styles';

import HeaderTitle from '../components/shared/HeaderTitle';
import HeaderBackground from '../components/shared/HeaderBackground';

class NavUtils {

  getHeaderOptions(heading: string): NativeStackNavigationOptions {
    return {
      headerTitleAlign: 'center',
      headerTitle: (props) => <HeaderTitle heading={heading} />,
      headerBackground: () => <HeaderBackground />,
      headerTintColor: Colors.grey130,
      headerBackTitleVisible: false
    };
  }

  setHeaderTitle(title: string, navigation: NavigationProp<any>): void {
    const headerTitle = () => <HeaderTitle heading={title} />;
    navigation.setOptions({ headerTitle });
  }

}

const navUtils = new NavUtils();

export default navUtils;
