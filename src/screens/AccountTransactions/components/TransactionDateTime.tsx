import { StyleSheet } from 'react-native';
import TimeAgo from 'react-timeago'
import { Colors, Typography } from '../../../styles';
import { AppText } from '../../../components/shared/AppText';
import formatTime from '../../../utils/formatTime';
import formatDate from '../../../utils/formatDate';

const DateText = (props) => <AppText style={styles.dateTime}>{props.children}</AppText>;

interface Props {
  date: Date;
}

export default function TransactionDateTime({
  date
}: Props) {

  const timeFormatter = (value: number, unit: string, suffix: string) => {
    if (unit === 'second') {
        return 'less than a minute ' + suffix;
    } else if (unit === 'minute' || unit === 'hour') {
        return `${value} ${unit}${
          value !== 1 ? 's' : ''
      } ${suffix}`;
    } else {
      return `${formatTime(date)} - ${formatDate(date)}`;
    }
  };
  
  return (
    <TimeAgo
      date={date}
      component={DateText}
      live={true}
      formatter={timeFormatter}
    />
  );
}

const styles = StyleSheet.create({
  dateTime: {
    ...Typography.fontFamily.sfProDisplayRegular,
    ...Typography.fontSize.x4,
    color: Colors.grey130
  }
});
