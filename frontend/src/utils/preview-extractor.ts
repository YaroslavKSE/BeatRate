// interface TrackPreview {
//     audioPreview?: {
//         format: string;
//         url: string;
//     };
// }
//
// export async function getTrackPreviewUrl(spotifyTrackId: string): Promise<string | null> {
//     try {
//         const embedUrl = `/spotify/embed/track/${spotifyTrackId}`;
//         const response = await fetch(embedUrl);
//         const html = await response.text();
//
//         const matches = html.match(/"audioPreview":\s*{\s*"url":\s*"([^"]+)"/);
//         return matches ? matches[1] : null;
//     } catch (error) {
//         console.error("Failed to fetch Spotify preview URL:", error);
//         return null;
//     }
// }
//
// export async function getSeveralPreviewsUrl(spotifyId: string, fetchType: string = "album"): Promise<string[] | null> {
//     try {
//         const embedUrl = `/spotify/embed/${fetchType}/${spotifyId}`;
//         const response = await fetch(embedUrl);
//         const html = await response.text();
//
//         const scriptRegex = /<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/s;
//         const match = html.match(scriptRegex);
//         if (!match) {
//             console.warn("Could not find embedded JSON in album page");
//             return null;
//         }
//
//         const json = JSON.parse(match[1]);
//         const trackList = json?.props?.pageProps?.state?.data?.entity?.trackList;
//
//         if (!Array.isArray(trackList)) {
//             console.warn("No trackList found in album data");
//             return null;
//         }
//
//         const previewUrls = trackList
//             .map((track: TrackPreview) => track.audioPreview?.url)
//             .filter((url: string | undefined): url is string => typeof url === 'string');
//
//         return previewUrls.length > 0 ? previewUrls : null;
//     } catch (error) {
//         console.error("Failed to fetch Spotify album preview URLs:", error);
//         return null;
//     }
// }