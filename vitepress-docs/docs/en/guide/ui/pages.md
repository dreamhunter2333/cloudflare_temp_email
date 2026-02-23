# Cloudflare Pages Frontend

<script setup>
import { ref } from 'vue'
import JSZip from 'jszip';

const domain = ref("")
const downloadUrl = ref("")
const tip = ref("Download")

const generate = async () => {
    try {
        const response = await fetch("/ui_install/frontend.zip");
        const arrayBuffer = await response.arrayBuffer();
        var zip = new JSZip();
        await zip.loadAsync(arrayBuffer);
        let target_content = ""
        let target_path = ""
        const directory = zip.folder("assets");
        if (directory) {
            for (const [relativePath, zipEntry] of Object.entries(directory.files)) {
                console.log(relativePath);
                if (relativePath.startsWith("assets/index-") && relativePath.endsWith(".js")){
                    let content = await zipEntry.async("string");
                    content = content.replace("https://temp-email-api.xxx.xxx", domain.value);
                    target_path = relativePath;
                    zip.file(relativePath, content);
                    break;
                }
            }
        }
        if (!target_path) {
            tip.value = "Generation failed";
            downloadUrl.value = '';
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(blob);
        downloadUrl.value = url;
    } catch (error) {
        console.error("Error: ", error);
    }
}
</script>

1. Click `Compute (Workers)` -> `Workers & Pages` -> `Create`

    ![create pages](/ui_install/worker_home.png)

2. Select `Pages`, choose `Use direct upload`

    ![pages](/ui_install/pages.png)

3. Enter the address of the deployed worker. The address should not include a trailing `/`. Click generate, and if successful, a download button will appear. You will get a zip package.
    - The worker domain here is the backend API domain. For example, if I deployed at `https://temp-email-api.awsl.uk`, then fill in `https://temp-email-api.awsl.uk`
    - If your domain is `https://temp-email-api.xxx.workers.dev`, then fill in `https://temp-email-api.xxx.workers.dev`

    > [!warning] Note
    > The `worker.dev` domain is not accessible in China, please use a custom domain.

    <div :class="$style.container">
        <input :class="$style.input" type="text" v-model="domain" placeholder="Please enter address"></input>
        <button :class="$style.button" @click="generate">Generate</button>
        <a v-if="downloadUrl" :href="downloadUrl" download="frontend.zip">{{ tip }}</a>
    </div>

    > [!NOTE]
    > You can also deploy manually. Download the zip from here: [frontend.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/frontend.zip)
    >
    > Modify the index-xxx.js file in the archive, where xx is a random string
    >
    > Search for `https://temp-email-api.xxx.xxx` and replace it with your worker's domain, then deploy the new zip file

4. Select `Pages`, click `Create Pages`, modify the name, upload the downloaded zip package, and then click `Deploy`

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
</style>
