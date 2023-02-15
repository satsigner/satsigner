import { KeyboardAvoidingView, StatusBar } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

export default function KeyboardAvoidingViewWithHeaderOffset(props: any) {
    const headerHeight = useHeaderHeight();
    
    return (
        <KeyboardAvoidingView
            style={props.style}
            behavior={Platform.select({
                ios: "padding",
                android: ""
            })}
            keyboardVerticalOffset={headerHeight + StatusBar.currentHeight}
        >
            {props.children}
        </KeyboardAvoidingView>
    );
}
