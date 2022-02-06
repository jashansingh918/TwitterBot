const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();

const dbRef = admin.firestore().doc('tokkens/demo');

const TwitterApi = require('twitter-api-v2').default;
const twitterClient = new TwitterApi({
    clientId: 'YOUR_CLIENT_ID',
    clientSecret: 'YOUR_CLIENT_SECRET',
});

const callbackURL= 'http:/127.0.0.1:5000/twitterbot-c19b6/us-central1/callback';

exports.auth = functions.https.onRequest((request, response) => {
    const { url, codeVerifier, state} = twitterClient.generateOAuth2AuthLink(
        callbackURL,
        { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access']},
    );

    await dbRef.set({ codeVerifier, state});

    response.redirect(url);
});

exports.callback = functions.https.onRequest((request, response) => {

    const{ state, code } = request.query;

    const dbSnapshot = await dbRef.get();
    const { codeVerifier, state : storedState } = dbSnapshot.data();

    if ( state !== storedState){
        return response.status(400).send('Stored tokens do not match');
    }

    const {
        client: loggedClient,
        accessToken,
        refreshToken,
    } = await twitterClient.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackURL,
    });

    await dbRef.set({ accessToken, refreshToken});

    response.sendStatus(200);
});

exports.tweet = functions.https.onRequest((request, response) => {

    const { refreshToken } = (await dbRef.get()).data();

    const {
        client: refreshedClient,
        accessToken,
        refreshToken: newRefreshToken,
    } = await twitterClient.refreshOAuth2Token(refreshToken);

    await dbRef.set({ accessToken, refreshToken: newRefreshToken});

    const nextTweet = await openai.createCompletion('text-davinci-001',{
        prompt: 'tweet something cool for #techtwitter',
        max_tokens: 64,
    });

    const { data } = await refreshedClient.v2.tweet(
        nextTweet.data.choices[0].text
    );

    response.send(data);
});

const { Configuration, OpenAIApi} = require('openai');
const configuration = new Configuration({
    organization: 'YOUR_OPENAI_ORG',
    apiKey: 'YOUR_OPENAI_SECRET',
});

const openai = new OpenAIApi(configuration);
