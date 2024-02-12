// based on react-native-animated-numbers

import React from 'react';
import { Animated, Easing, Text, View } from 'react-native';

const NUMBERS = [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9 ];

const usePrevious = (value) => {
	const ref = React.useRef();
	React.useEffect(() => {
		ref.current = value;
	});

	if (typeof ref.current === 'undefined') {
		return 0;
	}

	return ref.current;
};

const AnimatedNumber = ({
	animateToNumber,
	fontStyle,
	animationDuration
}) => {

	const prevNumber = usePrevious(animateToNumber);
	console.log('prev', prevNumber);
	console.log('to', animateToNumber);
	const animateToNumberString = String(Math.abs(animateToNumber));
	const prevNumberString = String(Math.abs(prevNumber));

	// "98" => [9, 8]
	const animateToNumbersArr = Array.from(animateToNumberString, Number);
	const prevNumbersArr = Array.from(prevNumberString, Number);

	const [numberHeight, setNumberHeight] = React.useState(0);

	// animated value for every digit
	// called once per animation
	const animations = animateToNumbersArr.map((__, index) => {
		if (typeof prevNumbersArr[index] !== 'number') {
			return new Animated.Value(0);
		}
		// Animated value is the digit value * negative height of a digit
		const animationHeight = -1 * (numberHeight * prevNumbersArr[index]);
		return new Animated.Value(animationHeight);
	});

	const setButtonLayout = (e) => {
		setNumberHeight(e.nativeEvent.layout.height);
	};

	React.useEffect(() => {

		// called once per digit per animation

		animations.forEach((animation, index) => {
			if (typeof animateToNumbersArr[index] !== 'number') {
				return;
			}

			// timing called on the animated value to change its values over a time duration
			// it is animating the Y value
			Animated.timing(animation, {
				toValue: -1 * (numberHeight * animateToNumbersArr[index]),
				duration: animationDuration || 1400,
				useNativeDriver: true,
				easing: Easing.inOut(Easing.cubic),
			}).start();
		});
	}, [animateToNumber, numberHeight]);

	// called once per digit per animation
	const getTranslateY = (index) => {
		return animations[index];
	};

	return (
		<>
			{numberHeight !== 0 && (
				<View style={{ flexDirection: 'row' }}>
					{animateToNumbersArr.map((n, index) => {

						return (
							<View
								key={index}
								// height of the view is only numberHeight so you only see one digit in column
								style={{ height: (numberHeight), overflow: 'hidden' }}
							>
								<Animated.View
									style={[
										{
											transform: [
												{
													translateY: getTranslateY(index),
												},
											],
										},
									]}
								>
									{/* // renders out Views with Texts for each digit starting 0 through 9 */}
									{NUMBERS.map((number, i) => (
										<View key={i}>
											<Text style={[fontStyle, { height: numberHeight }]}>
												{number}
											</Text>
										</View>
									))}
								</Animated.View>
							</View>
						);
					})}
				</View>
			)}
			<Text
				style={[fontStyle, { position: 'absolute', top: -999999 }]}
				onLayout={setButtonLayout}
			>
				{0}
			</Text>
		</>
	);
};

export default AnimatedNumber;