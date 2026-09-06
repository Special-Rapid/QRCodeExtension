import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SharedImageRoute() {
  const { token, captureError } = useLocalSearchParams<{ token?: string; captureError?: string }>();
  const params: { shareToken?: string; captureError?: string } = {};
  if (typeof token === 'string') params.shareToken = token;
  if (typeof captureError === 'string') params.captureError = captureError;
  return <Redirect href={{ pathname: '/', params }} />;
}
