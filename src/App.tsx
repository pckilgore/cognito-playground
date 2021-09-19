import React from "react";
import { Auth, Hub } from "aws-amplify";
import { authExchange } from "@urql/exchange-auth";
import { makeOperation, dedupExchange, fetchExchange } from "@urql/core";
import { cacheExchange } from "@urql/exchange-graphcache";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react";
import { createClient, Provider } from "urql";
import { Env, isCookie } from "./Environment";
import { Main } from "./Main.gen";

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

function GraphQLProvider({ children }: { children: React.ReactNode }) {
  const { Auth } = useAuth();

  const client = React.useMemo(
    () =>
      createClient({
        url: Env.REACT_APP_ENDPOINT,
        exchanges: [
          dedupExchange,
          cacheExchange({}),
          authExchange({
            addAuthToOperation: ({ authState, operation }) => {
              if (!authState) {
                return operation;
              }
              const token = authState.getIdToken().getJwtToken();
              return makeOperation(operation.kind, operation, {
                ...operation.context,
                fetchOptions: {
                  headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  },
                },
              });
            },
            willAuthError: ({ authState }) => {
              if (!authState) return true;
              return !authState.isValid();
            },
            didAuthError: ({ error }) => {
              // check if the error was an auth error (this can be implemented in various ways, e.g. 401 or a special error code)
              // TODO(pckilgore)
              return error.graphQLErrors.some(
                (e) => e.extensions?.code === "FORBIDDEN"
              );
            },
            getAuth: () => {
              return Auth.currentSession();
            },
          }),
          fetchExchange,
        ],
      }),
    [Auth]
  );

  return <Provider value={client}>{children}</Provider>;
}

export default withAuthenticator(() => (
  <AuthProvider>
    <GraphQLProvider>
      <Main />
      <AmplifySignOut />
    </GraphQLProvider>
  </AuthProvider>
));
