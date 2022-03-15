import React from "react";
import { Auth, Hub } from "aws-amplify";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react";
import { Env, isCookie } from "./Environment";

Auth.configure({
  region: Env.REACT_APP_AWS_REGION,
  userPoolWebClientId: Env.REACT_APP_USER_POOL_CLIENT,
  userPoolId: Env.REACT_APP_USER_POOL_ID,
  authenticationFlowType: "USER_SRP_AUTH",
  ...(isCookie
    ? {
        cookieStorage: {
          secure: Env.REACT_APP_COOKIE_SEC,
          path: Env.REACT_APP_COOKIE_PATH,
          expires: Env.REACT_APP_COOKIE_EXPIRES,
          domain: Env.REACT_APP_COOKIE_DOMAIN,
        },
      }
    : null),
});

type authcontext = {
  user: null | unknown;
  Auth: typeof Auth;
};
const AuthContext = React.createContext<null | authcontext>(null);

function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw Error("useAuth must be used within its provider");
  }
  return ctx;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    function listener(data: { payload: { event: string } }) {
      switch (data.payload.event) {
        case "signIn":
        case "tokenRefresh":
          Auth.currentAuthenticatedUser().then(setUser);
          break;
        case "signOut": {
          setUser(null);
          break;
        }
        default:
      }
    }
    Auth.currentAuthenticatedUser().then(setUser);

    Hub.listen("auth", listener);

    return () => Hub.remove("auth", listener);
  }, []);

  const context = React.useMemo(() => ({ user, Auth }), [user]);

  return user ? (
    <AuthContext.Provider value={context}>{children}</AuthContext.Provider>
  ) : null;
}

export default withAuthenticator(() => (
  <AuthProvider>
    <div>App Goes here</div>
    <AmplifySignOut />
  </AuthProvider>
));
