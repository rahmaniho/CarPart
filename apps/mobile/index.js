import { AppRegistry, I18nManager } from 'react-native';
import App from './App';

if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

AppRegistry.registerComponent('main', () => App);
export default App;
