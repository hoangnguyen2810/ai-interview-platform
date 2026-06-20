import { StreamVideoClient } from "@stream-io/video-react-sdk";

export function createStreamClient(apiKey: string, user: any, token: string) {
  return new StreamVideoClient({
    apiKey,
    user,
    token,
  });
}
