import { StreamVideoClient } from "@stream-io/video-react-sdk";

export function createStreamClient(apiKey: string, user: any, token: string) {
  return new StreamVideoClient({
    apiKey,
    user,
    token,
    options: {
      logLevel: "warn",
      logger: (logLevel, message, ...args) => {
        if (typeof message === "string" && message.includes("client:post")) {
          return; // bỏ qua log network POST bình thường
        }
        console[logLevel === "error" ? "error" : "log"](message, ...args);
      },
    },
  });
}
