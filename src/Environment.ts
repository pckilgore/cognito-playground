const requiredEnv = {
  REACT_APP_AWS_REGION: "",
  REACT_APP_USER_POOL_CLIENT: "",
  REACT_APP_USER_POOL_ID: "",
  REACT_APP_ENDPOINT: "",
  NODE_ENV: "",
};

const optionalEnv = {
  REACT_APP_COOKIE_SEC: "",
  REACT_APP_COOKIE_DOMAIN: "",
  REACT_APP_COOKIE_PATH: "",
  REACT_APP_COOKIE_EXPIRES: "",
};

type Environment = typeof requiredEnv & Partial<typeof optionalEnv>;

const resolved = Object.keys({
  ...requiredEnv,
  ...optionalEnv,
}).reduce((acc, key) => {
  const val = process.env[key];
  if (key in requiredEnv && !val) {
    throw Error("Missing Required Environment Refusing to Start");
  }
  if (val) {
    // @ts-ignore
    acc[key] = val;
  }
  return acc;
}, {}) as Environment;

export const Env = resolved;
export const isCookie =
  resolved.REACT_APP_COOKIE_SEC &&
  resolved.REACT_APP_COOKIE_EXPIRES &&
  resolved.REACT_APP_COOKIE_PATH &&
  resolved.REACT_APP_COOKIE_DOMAIN;
