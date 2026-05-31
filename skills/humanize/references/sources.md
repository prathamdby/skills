# Sources

## Articles and Blogs

| Title                                                                 | Author / Publication  | URL                                                                                                                                            | Summary                                                                        |
| --------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| AI slop                                                               | Wikipedia             | https://defuddle.md/https://en.wikipedia.org/wiki/AI_slop                                                                                      | Overview of "slop" as low-quality AI content across platforms.                 |
| Slop is the new name for unwanted AI-generated content                | Simon Willison        | https://defuddle.md/https://simonwillison.net/2024/May/8/slop/                                                                                 | Essay coining and advocating for "slop" as the spam-equivalent for AI output.  |
| A Concerning Trend                                                    | Neil Clarke           | https://defuddle.md/https://neil-clarke.com/a-concerning-trend/                                                                                | Clarkesworld editor on the flood of AI story spam forcing submission closures. |
| Spam, junk … slop? The latest wave of AI behind the 'zombie internet' | The Guardian          | https://defuddle.md/https://www.theguardian.com/technology/article/2024/may/19/spam-junk-slop-the-latest-wave-of-ai-behind-the-zombie-internet | How AI text and images fuel content farms and degrade the web.                 |
| AI-Generated Slop Is Already In Your Public Library                   | 404 Media             | https://defuddle.md/https://www.404media.co/ai-generated-slop-is-already-in-your-public-library-3/                                             | Investigates AI-generated books entering public library digital catalogs.      |
| AI-text detection tools are really easy to fool                       | MIT Technology Review | https://defuddle.md/https://www.technologyreview.com/2023/07/07/1075982/ai-text-detection-tools-are-really-easy-to-fool/                       | Light human edits and paraphrasers break commercial detectors.                 |
| GPT detectors are biased against non-native English writers           | Stanford HAI          | https://defuddle.md/https://hai.stanford.edu/news/ai-detectors-biased-against-non-native-english-writers                                       | Accessible explainer on structural bias in detection tools.                    |

## Research Papers

| Title                                                                                     | Authors                    | URL                                                  | Summary                                                                          |
| ----------------------------------------------------------------------------------------- | -------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Can AI-Generated Text be Reliably Detected?                                               | Sadasivan et al. (2023)    | https://defuddle.md/https://arxiv.org/abs/2303.11156 | Core result: detectors fail under paraphrase attacks; detection is an arms race. |
| DetectGPT: Zero-Shot Machine-Generated Text Detection using Probability Curvature         | Mitchell et al. (2023)     | https://defuddle.md/https://arxiv.org/abs/2301.11305 | Foundational zero-shot detector using log-probability curvature.                 |
| GPT detectors are biased against non-native English writers                               | Liang et al. (2023)        | https://defuddle.md/https://arxiv.org/abs/2304.02819 | ~61% false-positive rate on non-native English essays.                           |
| Testing of detection tools for AI-generated text                                          | Weber-Wulff et al. (2023)  | https://defuddle.md/https://arxiv.org/abs/2306.15666 | Evaluation of 14 tools; most below 80% accuracy.                                 |
| Paraphrasing evades detectors of AI-generated text, but retrieval is an effective defense | Krishna et al. (2023)      | https://defuddle.md/https://arxiv.org/abs/2303.13408 | Paraphrase breaks detectors; proposes retrieval-based verification.              |
| A Watermark for Large Language Models                                                     | Kirchenbauer et al. (2023) | https://defuddle.md/https://arxiv.org/abs/2301.10226 | Foundational green-list watermarking for LLM outputs.                            |
| RAID: A Shared Benchmark for Robust Evaluation of Machine-Generated Text Detectors        | Dugan et al. (2024)        | https://defuddle.md/https://arxiv.org/abs/2405.07940 | Stress-test benchmark; many tools collapse under realistic conditions.           |
| Spotting LLMs With Binoculars: Zero-Shot Detection of Machine-Generated Text              | Hans et al. (2024)         | https://defuddle.md/https://arxiv.org/abs/2401.12070 | Perplexity-ratio method for zero-shot detection.                                 |

## Quick Reading Paths

| Goal                            | Start Here                                    |
| ------------------------------- | --------------------------------------------- |
| Understand why detection fails  | Sadasivan → Weber-Wulff → MIT TR              |
| Understand fairness concerns    | Liang et al. → Stanford HAI → Washington Post |
| Understand technical baselines  | DetectGPT → Binoculars → RAID                 |
| Understand the cultural problem | Simon Willison → Neil Clarke → The Guardian   |
