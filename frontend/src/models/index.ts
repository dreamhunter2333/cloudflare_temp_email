export type UserOauth2Settings = {
    name: string;
    clientID: string;
    clientSecret: string;
    authorizationURL: string;
    accessTokenURL: string;
    accessTokenFormat?: string;
    userInfoURL: string;
    redirectURL: string;
    logoutURL?: string;
    userEmailKey: string;
    enableEmailFormat?: boolean;  // Enable email format transformation
    userEmailFormat?: string;     // Regex pattern to match email
    userEmailReplace?: string;    // Replacement template using $1, $2, etc.
    scope: string;
    enableMailAllowList?: boolean | undefined;
    mailAllowList?: string[] | undefined;
}
