# Cloudflare Pages Frontend

<script setup>
import { ref } from 'vue'
import JSZip from 'jszip';

const domain = ref("")
const downloadUrl = ref("")
const tip = ref("Download")
const errorMessage = ref("")

const resetDownloadUrl = () => {
    if (!downloadUrl.value) {
        return
    }
    window.URL.revokeObjectURL(downloadUrl.value)
    downloadUrl.value = ""
}

const validateDomain = (value) => {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
        return "Please enter a backend API URL starting with https://"
    }
    if (/\s/.test(normalizedValue)) {
        return "The backend API URL must not contain whitespace characters"
    }
    if (!normalizedValue.startsWith("https://")) {
        return "The backend API URL must start with https://"
    }
    if (normalizedValue.endsWith("/")) {
        return "Do not add a trailing / to the backend API URL"
    }
    try {
        const url = new URL(normalizedValue)
        if (url.protocol !== "https:") {
            return "The backend API URL must start with https://"
        }
        if (url.pathname !== "/" || url.search || url.hash) {
            return "Please enter the backend API root URL only, without a path, query, or hash"
        }
    } catch {
        return "The backend API URL format is invalid"
    }
    return ""
}

const generate = async () => {
    const normalizedDomain = domain.value.trim()
    const validationError = validateDomain(normalizedDomain)
    errorMessage.value = validationError
    resetDownloadUrl()
    if (validationError) {
        return
    }
    domain.value = normalizedDomain
    let timeoutId = 0
    try {
        const controller = new AbortController()
        timeoutId = window.setTimeout(() => controller.abort(), 10000)
        const response = await fetch("/ui_install/frontend.zip", {
            signal: controller.signal
        });
        if (!response.ok) {
            errorMessage.value = "Failed to download the frontend zip file. Please try again later"
            return
        }
        const arrayBuffer = await response.arrayBuffer();
        var zip = new JSZip();
        await zip.loadAsync(arrayBuffer);
        const indexEntry = zip.file("index.html");
        if (!indexEntry) {
            errorMessage.value = "Could not find index.html. Generation failed"
            return
        }
        const content = await indexEntry.async("string");
        const configPattern = /(<script id="app-config" type="application\/json">)([\s\S]*?)(<\/script>)/;
        const configMatch = content.match(configPattern);
        if (!configMatch) {
            errorMessage.value = "Could not find app-config. Generation failed"
            return
        }
        let appConfig = {};
        try {
            appConfig = JSON.parse(configMatch[2]);
        } catch {
            errorMessage.value = "Invalid app-config. Generation failed"
            return
        }
        if (!appConfig || typeof appConfig !== "object" || Array.isArray(appConfig)) {
            errorMessage.value = "Invalid app-config. Generation failed"
            return
        }
        appConfig.API_BASE = normalizedDomain;
        zip.file("index.html", content.replace(
            configPattern,
            (_, openTag, _config, closeTag) => `${openTag}${JSON.stringify(appConfig)}${closeTag}`
        ));
        const blob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(blob);
        errorMessage.value = ""
        downloadUrl.value = url;
    } catch (error) {
        console.error("Error: ", error);
        if (error instanceof DOMException && error.name === "AbortError") {
            errorMessage.value = "Download timed out. Please refresh the page and try again"
            return
        }
        errorMessage.value = "Generation failed. Please refresh the page and try again"
    } finally {
        window.clearTimeout(timeoutId)
    }
}
</script>

1. Click `Compute (Workers)` -> `Workers & Pages` -> `Create`

    ![create pages](/ui_install/worker_home.png)

2. Select `Pages`, choose `Use direct upload`

    ![pages](/ui_install/pages.png)

3. Enter the deployed worker address. It must be the backend API root URL, start with `https://`, and must not include a trailing `/`. Click generate, and if successful, a download button will appear. You will get a zip package.
    - The worker domain here is the backend API domain. For example, if I deployed at `https://temp-email-api.awsl.uk`, then fill in `https://temp-email-api.awsl.uk`
    - If your domain is `https://temp-email-api.xxx.workers.dev`, then fill in `https://temp-email-api.xxx.workers.dev`
    - Do not enter your frontend `Pages` domain, and do not include paths like `/admin` or `/api`. Otherwise frontend requests will hit the wrong address and you may see `Cannot read properties of undefined (reading 'map')` or `405 Method Not Allowed`
    - Before filling it in, open `https://your-worker-domain/open_api/settings` in the browser and confirm it returns JSON. If it returns HTML, 404, 405, or a Cloudflare challenge page, fix the Worker binding, variables, or security policy first

    > [!warning] Note
    > The `worker.dev` domain is not accessible in China, please use a custom domain.
    >
    > Do not enable security policies such as Under Attack, Bot Fight, or Managed Challenge on the backend API domain. Frontend XHR requests cannot complete those browser challenges, and the common symptom is `Network Error`.

    <div :class="$style.container">
        <input :class="$style.input" type="text" v-model="domain" placeholder="Enter a backend API URL starting with https://"></input>
        <button :class="$style.button" @click="generate">Generate</button>
        <a v-if="downloadUrl" :href="downloadUrl" download="frontend.zip">{{ tip }}</a>
    </div>
    <p :class="$style.hint">Example: `https://temp-email-api.example.com`. Do not enter the frontend Pages domain and do not add a trailing `/`.</p>
    <p v-if="errorMessage" :class="$style.error">{{ errorMessage }}</p>

    > [!NOTE]
    > You can also deploy manually. Download the zip from here: [frontend.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/frontend.zip)
    >
    > Extract the archive and edit `app-config` in `index.html`. When finished, compress all files again and upload the archive. Do not include the outer directory in the archive.
    >
    > If you entered the wrong address the first time and still see errors after redeploying, test in an incognito window or clear browser cache so the browser stops using the old frontend assets.

    ```html
    <script id="app-config" type="application/json">
    {
      "API_BASE": "https://temp-email-api.example.com",
      "DEFAULT_LANG": "en"
    }
    </script>
    ```

    `API_BASE` is the backend API root URL without a trailing `/`; `DEFAULT_LANG` supports `zh`, `en`, `es`, `pt-BR`, `ja`, and `de`. You can also set `CF_WEB_ANALY_TOKEN`, `IS_TELEGRAM`, `GOOGLE_AD_CLIENT`, and `GOOGLE_AD_SLOT`; see [Frontend Variables](/en/guide/frontend-vars) for their purpose and values. Fields present in `app-config` override the corresponding settings built into JavaScript, while omitted fields keep their existing settings.

4. Select `Pages`, click `Create Pages`, modify the name, upload the downloaded zip package

    > [!warning] Important: SPA Mode
    > This project is a Single-Page Application (SPA). **You must expand the advanced options during deployment and set "Not Found handling" to `Single-page application (SPA)`**.
    > Otherwise, refreshing the page or directly accessing sub-paths like `/admin` will return a 404 error.
    >
    > ![pages spa setting](/ui_install/pages-spa-setting.jpg)

    Then click `Deploy`

    ![pages1](/ui_install/pages-1.png)

5. Open the `Pages` you just deployed, click `Custom Domain`. Here you can add your own domain, or you can use the automatically generated `*.pages.dev` domain. If you can open the domain, the deployment is successful.

    ![pages domain](/ui_install/pages-domain.png)

<style module>
.container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
}
.input {
    border: 2px solid deepskyblue;
    margin-right: 10px;
    width: 75%;
    border-radius: 5px;
}

.button {
    background-color: deepskyblue;
    padding: 5px 10px;
    border-radius: 5px;
    margin-right: 10px;
}

.button:hover {
    background-color: green;
}

.hint {
    margin-top: 8px;
    color: var(--vp-c-text-2);
}

.error {
    margin-top: 8px;
    color: #d03050;
}
</style>
