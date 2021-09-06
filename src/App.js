import React from "react";
import { Auth, Hub } from "aws-amplify";
import { authExchange } from "@urql/exchange-auth";
import { makeOperation, dedupExchange, fetchExchange } from "@urql/core";
import { cacheExchange } from "@urql/exchange-graphcache";
import { withAuthenticator, AmplifySignOut } from "@aws-amplify/ui-react";
import { useQuery, createClient, Provider } from "urql";

const TodosQuery = `
  query {
    me {
      id
      display_name
    }
  }
`;

// Pull this shit from ENV
const developerCookie = {
  secure: false,
  domain: "localhost",
  path: "/",
  expires: 365,
};

Auth.configure({
  region: process.env.REACT_APP_AWS_REGION,
  userPoolWebClientId: process.env.REACT_APP_USER_POOL_CLIENT,
  userPoolId: process.env.REACT_APP_USER_POOL_ID,
  authenticationFlowType: "USER_SRP_AUTH",
  cookieStorage: developerCookie,
});

const AuthContext = React.createContext(null);

function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw Error("useAuth must be used within its provider");
  }
  return ctx;
}

function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    function listener(data) {
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

function App() {
  const [result] = useQuery({
    query: TodosQuery,
  });

  const { data, fetching, error } = result;

  if (fetching) return <p>Loading...</p>;
  if (error) return <p>Oh no... {error.message}</p>;

  return <span>{data.me.display_name}</span>;
}

function GraphQLProvider({ children }) {
  const { Auth } = useAuth();

  const client = React.useMemo(
    () =>
      createClient({
        url: process.env.REACT_APP_ENDPOINT,
        exchanges: [
          dedupExchange,
          cacheExchange({}),
          authExchange({
            addAuthToOperation: ({ authState, operation }) => {
              if (!authState) {
                return operation;
              }
              const token = authState.getIdToken().jwtToken;
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
      <App />
      <AmplifySignOut />
    </GraphQLProvider>
  </AuthProvider>
));
