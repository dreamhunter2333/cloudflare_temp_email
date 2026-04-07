# Cloudflare Pages 前端

<script setup>
import { ref } from 'vue'
import JSZip from 'jszip';

const domain = ref("")
const downloadUrl = ref("")
const tip = ref("下载")
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
        return "请输入以 https:// 开头的后端 API 地址"
    }
    if (!normalizedValue.startsWith("https://")) {
        return "后端 API 地址必须以 https:// 开头"
    }
    if (normalizedValue.endsWith("/")) {
        return "后端 API 地址末尾不要带 /"
    }
    try {
        const url = new URL(normalizedValue)
        if (url.protocol !== "https:") {
            return "后端 API 地址必须以 https:// 开头"
        }
        if (url.pathname !== "/" || url.search || url.hash) {
            return "请填写后端 API 根地址，不要带路径、参数或锚点"
        }
    } catch {
        return "后端 API 地址格式不正确"
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
    try {
        const response = await fetch("/ui_install/frontend.zip");
        const arrayBuffer = await response.arrayBuffer();
        var zip = new JSZip();
        await zip.loadAsync(arrayBuffer);
        let target_path = ""
        const directory = zip.folder("assets");
        if (directory) {
            for (const [relativePath, zipEntry] of Object.entries(directory.files)) {
                console.log(relativePath);
                if (relativePath.startsWith("assets/index-") && relativePath.endsWith(".js")){
                    let content = await zipEntry.async("string");
                    content = content.replace("https://temp-email-api.xxx.xxx", normalizedDomain);
                    target_path = relativePath;
                    zip.file(relativePath, content);
                    break;
                }
            }
        }
        if (!target_path) {
            errorMessage.value = "没有找到前端入口文件，生成失败"
            return
        }
        const blob = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(blob);
        errorMessage.value = ""
        downloadUrl.value = url;
    } catch (error) {
        console.error("Error: ", error);
        errorMessage.value = "生成失败，请刷新页面后重试"
    }
}
</script>

1. 点击 `Compute (Workers)` -> `Workers & Pages` -> `Create`

    ![create pages](/ui_install/worker_home.png)

2. 选择 `Pages`，选择 `Use direct upload`

    ![pages](/ui_install/pages.png)

3. 输入部署的 worker 地址，必须填写后端 API 根地址，并且以 `https://` 开头，地址不要带 `/`，点击生成，成功会出现下载按钮，你会得到一个 zip 包
    - 此处 worker 域名为后端 api 的域名，比如我部署在 `https://temp-email-api.awsl.uk`，则填写 `https://temp-email-api.awsl.uk`
    - 如果你的域名是 `https://temp-email-api.xxx.workers.dev`，则填写 `https://temp-email-api.xxx.workers.dev`
    - 不要填写前端 `Pages` 自己的域名，也不要带 `/admin`、`/api` 等路径，否则前端请求会打到错误地址，可能出现 `Cannot read properties of undefined (reading 'map')` 或 `405 Method Not Allowed`

    > [!warning] 注意
    > `worker.dev` 域名在中国无法访问，请自定义域名

    <div :class="$style.container">
        <input :class="$style.input" type="text" v-model="domain" placeholder="请输入以 https:// 开头的后端 API 地址"></input>
        <button :class="$style.button" @click="generate">生成</button>
        <a v-if="downloadUrl" :href="downloadUrl" download="frontend.zip">{{ tip }}</a>
    </div>
    <p :class="$style.hint">示例：`https://temp-email-api.example.com`，不要填写前端 Pages 域名，也不要带结尾 `/`。</p>
    <p v-if="errorMessage" :class="$style.error">{{ errorMessage }}</p>

    > [!NOTE]
    > 你也可以手动部署，从这里下载 zip, [frontend.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/frontend.zip)
    >
    > 修改压缩包里面的 index-xxx.js 文件 ，xx 是随机的字符串
    >
    > 搜索 `https://temp-email-api.xxx.xxx` ，替换成你 worker 的后端 API 根地址，然后部署新的 zip 文件。如果填成前端 Pages 域名，常见现象就是页面报 `map` 错误或接口返回 `405`

4. 选择 `Pages`，点击 `Create Pages`, 修改名称，上传下载的 zip 包

    > [!warning] 重要：SPA 模式
    > 本项目是单页应用（SPA），**必须在部署时展开高级选项，将「未找到处理」设置为 `Single-page application (SPA)`**。
    > 否则刷新页面或直接访问 `/admin` 等子路径时会返回 404。

    然后点击 `Deploy`

    ![pages1](/ui_install/pages-1.png)

5. 打开 刚刚部署的 `Pages`，点击 `Custom Domain`  这里可以添加自己的域名，你也可以使用自动生成的 `*.pages.dev` 的域名。能打开域名说明部署成功。

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
