# Cloudflare Pages 前端

<script setup>
import { ref } from 'vue'
import JSZip from 'jszip';

const domain = ref("")
const downloadUrl = ref("")
const tip = ref("下载")

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
            tip.value = "生成失败";
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

1. 点击 `Compute (Workers)` -> `Workers & Pages` -> `Create`

    ![create pages](/ui_install/worker_home.png)

2. 选择 `Pages`，选择 `Use direct upload`

    ![pages](/ui_install/pages.png)

3. 输入部署的 worker 的地址, 地址不要带 `/`，点击生成，成功会出现下载按钮，你会得到一个 zip 包
    - 此处 worker 域名为后端 api 的域名，比如我部署在 `https://temp-email-api.awsl.uk`，则填写 `https://temp-email-api.awsl.uk`
    - 如果你的域名是 `https://temp-email-api.xxx.workers.dev`，则填写 `https://temp-email-api.xxx.workers.dev`

    > [!warning] 注意
    > `worker.dev` 域名在中国无法访问，请自定义域名

    <div :class="$style.container">
        <input :class="$style.input" type="text" v-model="domain" placeholder="请输入地址"></input>
        <button :class="$style.button" @click="generate">生成</button>
        <a v-if="downloadUrl" :href="downloadUrl" download="frontend.zip">{{ tip }}</a>
    </div>

    > [!NOTE]
    > 你也可以手动部署，从这里下载 zip, [frontend.zip](https://github.com/dreamhunter2333/cloudflare_temp_email/releases/latest/download/frontend.zip)
    >
    > 修改压缩包里面的 index-xxx.js 文件 ，xx 是随机的字符串
    >
    > 搜索 `https://temp-email-api.xxx.xxx` ，替换成你worker 的域名，然后部署新的zip文件

4. 选择 `Pages`，点击 `Create Pages`, 修改名称，上传下载的 zip 包，然后点击 `Deploy`

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
</style>
