---
title: Literature Review on Developing Artificial Intelligence to Advocate for Animal Rights
date: 2026-03-01
category: Research & Reports
author: Open Paws
excerpt: A review of the latest research and techniques that can be harnessed to develop an AI system uniquely aligned with advancing the interests of animals.
---

## Executive Summary

The field of artificial intelligence (AI) and machine learning (ML) is rapidly evolving, presenting both opportunities and challenges for organizations like Open Paws that aim to leverage these technologies for animal advocacy.

This literature review explores the latest research and techniques that can be harnessed to develop an AI system uniquely aligned with advancing the interests of animals.

**Key findings and recommendations:**

- Effective data curation, including multilingual datasets and debiasing techniques, is crucial for training AI systems free from speciesist biases and aligned with diverse cultural and linguistic contexts.

- Strategic pre-training approaches, such as instruction tuning and graph-based training, can enhance the AI's reasoning abilities and domain-specific knowledge.

- Systems architectures like Mixture of Experts (MoE) and modular cognitive designs hold promise for creating adaptable and specialised AI agents capable of autonomous decision-making and task execution.

- Fine-tuning models from human and AI feedback, coupled with advanced prompt engineering and prompt chaining methods, offers pathways for continuous improvement of the system's performance and ethical alignments.

- Future directions could include pursuing advancements in multi-modal, cognitive, and decentralised AI architectures, and implementing emerging technologies like brain-computer interfaces, neurofeedback devices and virtual reality, to enhance the effectiveness and reach of animal advocacy efforts in innovative and ethically responsible ways.

## Method

We sourced our material from an array of recently published papers, primarily from the last three months, though some foundational work dates back further.

Our selection process involved following a combined RSS feed of several journals that publish AI papers and handpicking those that resonate with our mission, resulting in about 1,000 abstracts.

Our exploration started with these abstracts, then extending to in-depth, selective reading. We discarded any studies that were found to be irrelevant on further investigation.

We've organised this review by applicability – beginning with immediate, actionable research and ending with future directions that may become pertinent as Open Paws grows and AI technology improves.

Each paper's essence is distilled into lay terms and directly hyperlinked, simplifying further investigation while providing a snapshot of its significance in advancing our mission.

The review begins with database creation and management, traverses through LLM pre-training and feedback-based fine-tuning (whether from humans or AI), delves into the intricacies of prompt chains and agent architectures, and culminates in prospective AI capabilities that hold promise for the future of Open Paws AI.

## Database Management and Curation

**Efficient and sophisticated data management is the cornerstone of Open Paws' AI-driven animal advocacy.**

**Harnessing advanced automation, we aim to refine our database with robust pre-processing, normalisation, and quality-enhancement frameworks.**

- A survey of [data management for LLMs](https://arxiv.org/abs/2312.01700) found that if training an LLM beyond 1 epoch, additional training should be done on a small subsection of the highest quality data. The authors recommend having a quality score to filter by within your database and to deduplicate automatically using semantic similarity search (i.e. remove entries that are too semantically similar). They found that a diverse range of domains and instructions is essential and that more complex instructions lead to better downstream performance.

- [SemDeDup](https://arxiv.org/abs/2303.09540) can be used to find and remove semantic deduplication in training sets for LLMs.

- We can use [tasksource](https://arxiv.org/abs/2301.05948) for data preprocessing and normalisation of HuggingFace datasets, automatically formatting them consistently.

**Leveraging automation for Open Paws' database management is instrumental in transforming vast data sets into actionable intelligence.**

## Data Extraction and Structuring

**With AI tools, Open Paws sees a pathway to transform unstructured data into valuable insights for advocacy strategies. Yet, ensuring the precision and impartiality of automated extractions remains paramount.**

- [Jellyfish](https://arxiv.org/abs/2312.01678), an open-source LLM built specifically for data pre-processing, can also be used for other data tasks like schema and entity matching. It’s a small model that can be run on a single GPU at 13B parameters and could be used to automate much of the extraction and structuring of data we need.

- [Bonito](https://github.com/BatsResearch/bonito) is an open-source model for turning any unstructured data into task-specific training data for instruction tuning.

- [LLMiner](https://arxiv.org/abs/2311.10614) can likewise extract Q&A pairs from unstructured documents through chain of thought reasoning.

- [This article in Towards Data Science](https://towardsdatascience.com/how-to-convert-any-text-into-a-graph-of-concepts-110844f22a1a) shows an automated framework for turning any text into a graph automatically.

- [MANTRA](https://www.researchgate.net/profile/Daniel-Konadl/publication/374501241_MANTRA_A_Topic_Modeling-Based_Tool_to_Support_Automated_Trend_Analysis_on_Unstructured_Social_Media_Data/links/6526dd113fa934104b17e895/MANTRA-A-Topic-Modeling-Based-Tool-to-Support-Automated-Trend-Analysis-on-Unstructured-Social-Media-Data.pdf) can be used to extract and analyse trends from unstructured social media data.

- [AutoIE](https://arxiv.org/abs/2401.16672) can be be used to extract data from scientific PDFs

- We can use a [Knowledge Pyramid](https://arxiv.org/abs/2401.09070) approach to extract high-level knowledge from existing low-level knowledge in graphs.

**The prospect of automating the conversion of social media buzz and dense scientific texts into digestible, actionable knowledge is exciting for Open Paws**

**Still, the adoption of these powerful tools demands rigour in quality control and adaptability, ensuring the data we mine is both dependable and relevant, fostering advocacy efforts that are not only reactive but also profoundly resonant with our cause.**

## Synthetic Data

**Synthetic data is a tool of significant potential and peril for AI development.**

**When utilised judiciously, it fosters generalisation and enriches conversation simulation; yet, it can undermine model stability and cognitive functions like reasoning if mismanaged.**

**A judicious blend of synthetic and authentic data is imperative.**

- [The Curse of Recursion](https://arxiv.org/pdf/2305.17493.pdf) paper demonstrates how synthetic data can induce model collapse, making models forget data from their pre-training. This emphasises the need for great care when using synthetic data.

- [The False Promise of Imitating Proprietary LLMs](https://arxiv.org/pdf/2305.15717.pdf) showed that training small models on synthetic data from large models increases hallucinations and decreases reasoning and logical abilities. This emphasises the importance of pre-training on high-quality data, not fine-tuning on low-quality data.

- The user simulator [Socratic](https://arxiv.org/pdf/2308.11534.pdf) was able to improve performance on base LLMs with synthetic data by modelling training on real human-AI conversations and then using this fine-tuned model to produce outputs that then become the inputs for training a new model called PlatoLM. This shows that when synthetic data is used it should model human-generated data as closely as possible to be effective.

- [Impossible Distillation](https://arxiv.org/pdf/2305.16635.pdf) showed that using self distillation between a student and teacher LM, you can generate a highly diverse and high-quality dataset without human feedback. When an LM was trained on these outputs it achieved significantly better results on much fewer parameters and generalised better than LMs trained on human feedback data. This shows that distilling synthetic data to the core knowledge produces much better results than using “raw” synthetic data (i.e. exported conversations with a system like ChatGPT)

- [Genixer](https://arxiv.org/pdf/2312.06731.pdf) demonstrates that using multimodal models to generate instruction tuning data can improve performance for image captioning and visual QA tasks. This demonstrates that synthetic data is most helpful in multimodal tasks.

**For Open Paws, synthetic data can be instrumental or detrimental depending on how it’s used. Our strategy must entail a balanced, multimodal, distilled and human-like approach in synthesising data.**

## Language and Linguistics

**By incorporating just 1% of tailored, high-quality data in additional languages, AI can master new languages effectively.**

**We must prioritise authentic content from local campaigners and refine our data filtering, with a vigilant approach towards eliminating speciesist bias.**

**A concerted effort to embrace linguistic diversity is necessary, especially in ensuring our system is not trained only or centrally on English-language materials and information sources.**

**This will be vital to our AI models remaining culturally sensitive and linguistically capable.**

- Language has a much deeper effect on our perception of the world than we usually think, and much of this cannot be captured without the understanding of people who natively speak that language. For example, [this paper](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1356039/full) showed that Arabic and English speakers view time as moving in different directions, whereas Arabic speakers view it as moving from right to left and English see it move from left to right. If you were to translate concepts around how time maps onto space using only word-for-word machine translations you would miss this nuance, which shows one small example of why we must use text written by native speakers to make our database multilingual, and don’t rely exclusively on machine translations.

- There’s a hypothesis called [Linguistic Relativity](https://en.wikipedia.org/wiki/Linguistic_relativity) that suggests language influences and shapes the worldview of it’s speakers and their cognition, and whilst the strongest version of this claim (that language ***determines*** thought) is likely false, there is strong empirical evidence to support the weaker version of this claim (that language ***influences*** thought). This seems to generalise to AI as well as humans, in that AI will often respond differently to the exact same prompt when translated into a different language.

- Of particular concern for us is the finding from [The Language Barrier paper](https://arxiv.org/pdf/2401.13136.pdf) that LLMs are much more likely to produce unsafe or irrelevant responses to malicious prompts in low resource languages (those which appear infrequently in pre-training data). This effect appears to be “hard-coded” into the LLM during pre-training and cannot be undone later through instruction-tuning. That means that if we don’t have sufficient data in a language during pre-training, it’s very unlikely we will be able to make much progress in removing speciesism in that language during fine-tuning, even if we fine-tune in that language.

- Luckily, we don’t need huge datasets in underrepresented languages to make a significant impact during pre-training. [LLaMA Beyond English](https://arxiv.org/pdf/2401.01055.pdf) found that models can achieve top transfer in knowledge and response quality in underrepresented languages with less than 1% of the pre-training data. So even if the vast majority of our data is in English, having at least a small amount in other languages will be enough to see huge leaps of performance in downstream tasks for those underrepresented languages - however, Open Paws will be taking additional steps to make sure our dataset is accessible to many other language communities and aware of their experiences and perspectives. It is important that we are not only be able to understand or generate texts in other languages, but remain sensitive to their cultural contexts.

- An additional consideration is that LLMs may struggle with language groups such as Chinese, compared to other languages that use Romanised scripts or alphabets. LLMs using token-based approaches have struggled with token planning and representing strings of Chinese characters as tokens. This was shown in the [Token-Free LLMs paper](https://arxiv.org/pdf/2401.03512.pdf) where token-based language models tended to fail Chinese spelling tests, whilst token-free LLMs using characters or bytes instead of tokens had much better performance.

- One possible explanation for this is the diversity of Chinese characters compared to English. English contains 26 characters whilst Chinese contains over 50,000 in common usage, and the number of possible tokens expands exponentially as you increase the number of characters per token (i.e. if you have a 3-character long token, there are 17,576 possible tokens in English and 125,000,000,000,000 possible tokens in Chinese)

- There are also many cultural and linguistic differences between different language variants that use Chinese characters (for example, Taiwan and China have very different cultural and linguistic contexts whilst Mandarin and Cantonese both use the same characters despite otherwise having numerous differences).

- [Taiwan LLM](https://arxiv.org/pdf/2311.17487.pdf) is an example of an open-source model and dataset built to address cultural and linguistic differences between Taiwan and China. In general, we can learn from global and local advocates how to best approach interfacing with their language communities - where common LLM methods struggle with cultural sensitivity and awareness, we should look to those linguistic communities for answers on how to best represent their language.

**We need to ensure we collect a diverse and multilingual dataset for pre-training and have local volunteers from a wide variety of regions and cultures participate in feedback collection.**

**We should also consider training a model specifically in Chinese that operates on bytes or characters, and a separate multilingual model operating on tokens for other languages.**

## Multiple Modalities

**Multimodal capabilities are the cornerstone for extending the reach and relevance of Open Paws' AI endeavours.**

**The choice between deploying an inherently multimodal network or incrementally integrating multiple sensory modules, tools or encoders within or on top of an LLM hinges on our resource pool and the trajectory of open-source AI.**

**Nevertheless, the proactive curation of a multimodal dataset positions us to adapt and thrive amidst technological shifts. Multimodality is not merely an option, it’s an essential.**

- The [Modality Plug-and-Play paper](https://arxiv.org/pdf/2312.07886.pdf) shows that unimodal encoders can be added to a flexible set of LLM blocks, which maintains accuracy across modalities whilst massively reducing training costs. This could be a good option if we raise less funding than expected and/or state-of-the-art LLMs are significantly better than state-of-the-art MLLMs when we begin training.

- [DreamLLM](https://arxiv.org/pdf/2309.11499.pdf) expands multimodal learning by directly learning from raw data for both text and images, bypassing the need for intermediate representations like CLIP embeddings. This end-to-end approach enables it to generate and comprehend multimodal content, including images and text, in their raw form.

- [OneLLM](https://arxiv.org/pdf/2312.03700.pdf) adds 8 modalities to LLMs at once using a multimodal encoder, which can more efficiently add multiple modalities compared to using a different encoder for each modality.

- [ByteFormer](https://arxiv.org/pdf/2306.00238.pdf) works on the byte level instead of tokens to allow for all possible modalities. Instead of predicting the next token, it predicts the next bytes, which removes the need for file decoding at inference time.

- [ImageBind-LLM](https://arxiv.org/pdf/2309.03905.pdf) introduces a multi-modality instruction tuning method that efficiently integrates LLMs with multiple modalities such as audio, 3D point clouds, and video, beyond just images and text. Unlike existing approaches that focus on image-text instruction tuning, ImageBind-LLM leverages a unique bind network and an attention-free gating mechanism to align and inject visual and other modality features directly into the LLaMA model's word tokens, enabling it to understand and generate language responses to a wider range of multi-modality inputs.

**In recognising the multifaceted nature of animal rights issues, Open Paws should adopt a multimodal approach.**

**By laying a foundation of multimodal data collection through text, image, and sound, as well as new and emerging data types, we can ensure our models remain up to date throughout new technological advancements.**

## Pre-Training

**Pre-training for AI in animal advocacy should strategically incorporate datasets with focused reasoning and role-specific tasks, possibly represented through graphs for heightened factual precision.**

**The Mixture of Experts architecture (or similar architectures inspired by it with potential for asynchronous domain-specific expert training), could be the key to addressing varied advocacy challenges.**

**Existing studies provide guidance on optimal training parameters—epochs, learning rates, data volume, and sparsity—preparing us for some level of data loss yet still anticipating performance gains in essential tasks.**

- [Scaling Expert Language Models with Unsupervised Domain Discovery](https://arxiv.org/abs/2303.14177) clusters related documents, trains “expert” LMs for each cluster and combines them for inference. This functions similarly to MoE but has the added advantage of being able to be trained asynchronously.

- The [How to Rewarm Your Model](https://arxiv.org/pdf/2308.04014.pdf) paper showed that while rewarming models first increases the loss on LLMs, in the longer run it improves the downstream performance, outperforming models trained from scratch—even for a large downstream dataset. It also showed that increasing the learning rate during continuing pre-training is the most effective and that continuing pre-training can be very effective at a fraction of the cost compared to pre-training a model from scratch.

- The [Give us the Facts](https://arxiv.org/pdf/2306.11489.pdf) paper showed that knowledge encoders and knowledge-guided pre-training tasks can be used to augment LLMs with graph understanding and that this leads to decreased hallucinations in downstream tasks.

- [Understanding In-Context Learning via Supportive Pretraining Data](https://arxiv.org/pdf/2306.15091.pdf) showed that supportive pre-training data for ICL tends to contain a higher proportion of rare, long-tail tokens and presents more challenging examples for the model, which may encourage the model to learn from diverse and complex contexts.

- [Latent Skill Discovery for Chain-of-Thought Reasoning](https://arxiv.org/pdf/2312.04684.pdf) indirectly supports the pre-training process by identifying and utilising latent reasoning skills from unsupervised data. This enables the creation of more focused and effective training examples, enhancing a model's pre-training phase with skills that improve its reasoning capabilities

- [LocMoE](https://arxiv.org/pdf/2401.13920.pdf) focuses on reducing the training overhead by optimising token routing and communication strategies. It introduces a novel routing strategy that promotes load balance and locality, thereby minimising communication overhead and improving model training performance. LocMoE demonstrates significant reductions in training time while maintaining accuracy, offering a practical solution to the performance bottlenecks in existing MoE models.

- [Scaling Data-Constrained Language Models](https://arxiv.org/pdf/2305.16264.pdf) found that 4 epochs is the “sweet spot” for retraining on the same data.

- [Scaling Laws for Sparsely-Connected Foundation Models](https://arxiv.org/pdf/2309.08520.pdf) presents a novel scaling law that connects sparsity, model size, and training data, identifying an "optimal sparsity" level that maximises performance for a given model size and data quantity. This research could guide the efficient training and deployment of large models by leveraging sparsity to balance computational costs and model performance.

- [Rethinking Learning Rate Tuning in the Era of Large Language Models](https://arxiv.org/pdf/2309.08859.pdf) introduces LRBench++, a benchmarking tool for evaluating and facilitating learning rate policies for both traditional neural networks and LLMs.

- [Critical Data Size from a Grokking Perspective](https://arxiv.org/pdf/2401.10463.pdf) investigates the critical data size for language models to shift from memorisation to generalisation, a phenomenon termed "grokking." It introduces a grokking configuration that reproduces grokking in simple language models through specific initialisations and weight decay adjustments. The study identifies a critical dataset size where models begin to generalise beyond memorisation. This size increases with the model's size, suggesting larger models need more data for effective learning and generalisation.

- [ReLoRA](https://arxiv.org/pdf/2307.05695.pdf) is a method that applies low-rank updates to train high-rank neural networks efficiently, especially transformers. The paper shows that ReLoRA can achieve comparable performance to traditional training methods but with increased efficiency, particularly as model size grows.

**The strategic development of AI within Open Paws hinges on a pre-training regimen that enables the model to grasp complex advocacy issues.**

**By embedding datasets woven with explicit reasoning and task-oriented examples, and potentially structuring them as graphs, we cultivate an AI equipped with robust factual accuracy, integral for complex advocacy tasks.**

**Using MoE-style architecture we can allow for the cultivation of specialised skills, fostering domain expertise crucial for tailored animal advocacy.**

**With empirical data on training epochs, learning rates, and data structures, we can sculpt an AI that not only excels technically, but is profoundly attuned to the ethical mandates of our mission.**

## Pruning, Compressing, Blending & Merging

**Pruning is effective for model compression but is not a means to permanently remove concepts, as pruned information can be reacquired.**

**Decisions on neuron elimination should be informed by their collective influence on outputs.**

**Model performance can be improved by blending or merging smaller models.**

**Additionally, training a compact model and then transferring the learned changes to a larger model helps to reduce the costs associated with large-scale training.**

**This suggests a novel approach: refining a cohort of smaller domain-specific models and amalgamating their expertise into more extensive systems, hence creating a large-scale, efficient model reflective of smaller-scale training investments.**

- [LoRA](https://arxiv.org/pdf/2106.09685.pdf) freezes the pre-trained model weights and injects trainable rank decomposition matrices into each layer of the Transformer architecture, greatly reducing the number of trainable parameters for downstream tasks. Compared to GPT-3 175B fine-tuned with Adam, LoRA can reduce the number of trainable parameters by 10,000 times and the GPU memory requirement by 3 times.

- [Large Language Models Relearn Removed Concepts](https://arxiv.org/pdf/2401.01814.pdf) shows that models can quickly regain performance post-pruning by relocating advanced concepts to earlier layers and reallocating pruned concepts to primed neurons with similar semantics.

- [Using Cooperative Game Theory to Prune Neural Networks](https://arxiv.org/pdf/2311.10468.pdf) introduces a method called Game Theory Assisted Pruning (GTAP), which reduces the neural network’s size while preserving its predictive accuracy. GTAP is based on eliminating neurons in the network based on an estimation of their joint impact on the prediction quality through game theoretic solutions.

- [EvoMerge](https://arxiv.org/pdf/2402.00070.pdf) utilises model merging for weight crossover and fine-tuning for weight mutation, establishing an evolutionary process to enhance models beyond traditional fine-tuning's limits.

- [Blending Is All You Need](https://arxiv.org/pdf/2401.02994.pdf) suggests that when specific smaller models are synergistically blended, they can potentially outperform or match the capabilities of much larger counterparts.

- [LM-Cocktail](https://arxiv.org/pdf/2311.13534.pdf) proposes a method to fine-tune language models while preserving their general capabilities, addressing catastrophic forgetting. This technique merges fine-tuned models with either the pre-trained base model or other domain-specific models through weighted averaging.

- [Tuning Language Models by Proxy](https://arxiv.org/pdf/2401.08565.pdf) introduces proxy-tuning, a method for adapting large language models (LLMs) at decoding time without modifying their weights. By utilising a smaller, fine-tuned model (expert) and its untuned version (anti-expert), proxy-tuning adjusts the output of a base LLM to emulate fine-tuning. This approach efficiently customises large LLMs, showing significant improvements in various tasks and benchmarks while retaining the model's general capabilities and knowledge.

- [QLoRA](https://arxiv.org/pdf/2305.14314.pdf) is an efficient fine-tuning method designed for quantised large language models, allowing for fine-tuning on a single GPU while preserving performance. It backpropagates gradients through a quantised model into low-rank adapters, achieving high performance with significantly reduced memory requirements.

**The integration of pruning, compression, blending, and merging techniques represents a transformative opportunity for Open Paws.**

**Through these methods, we can develop compact yet formidable AI models imbued with domain-specific expertise, circumventing the exorbitant costs typically tied to the training of large models.**

**Such customised tools grant us the flexibility to deploy AI for varied advocacy tasks and empower us to swiftly scale our AI capabilities to meet evolving challenges within animal advocacy.**

**Blending the acumen of smaller domain-specific models into larger, more comprehensive ones provides a cost-effective trajectory for continual improvement of the AI’s acuity and reactivity to the intricate fabric of animal advocacy. In this way, technological strides are directly translated into heightened efficacy and expansion of our advocacy impact.**

## Training on Human Feedback

**To elevate AI effectiveness in animal advocacy, multi-faceted training methods surpass simple binary comparisons. Utilising ranking scales with detailed feedback and introducing both affirming and counterfactual examples can significantly improve AI understanding of desired and unwelcome behaviours.**

**Furthermore, advancements in algorithms such as DPO, CRINGE, and MPO demonstrate superior performance to PPO.**

**In executing human feedback-based training, a composite of reward functions, including both subjective evaluations and objective metrics, should be adopted.**

**Securing a wide-ranging, inclusive group of human contributors for feedback is equally critical to cultivate a well-rounded, ethical AI perspective.**

- [DPO](https://arxiv.org/pdf/2305.18290.pdf) trains the LLM’s policy on human feedback directly rather than training a reward model for RL. This is easier to implement and cheaper to train but may be difficult or impossible to work with a variety of reward functions. It may also risk overfitting according to the MPO paper.

- [MPO](https://arxiv.org/pdf/2312.16430.pdf) combines the benefits of direct preference optimisation and reinforcement learning from human feedback. MPO uses importance sampling for off-policy optimisation, simplifying the learning process by removing the need for a reward model and reference policy. It addresses the challenge of aligning models with human preferences without the complexity and instability of previous methods.

- [Counterfactual Direct Preference Optimization](https://arxiv.org/pdf/2401.09566.pdf) allows for the fine-tuning of LLMs to encourage desirable outputs and discourage unwanted ones, effectively reducing biases and enhancing ethical alignment without extensive human intervention.

- [Enhancing Logical Reasoning in Large Language Models to Facilitate Legal Applications](https://arxiv.org/pdf/2311.13095.pdf) introduces Reinforcement Learning from Logical Feedback (RLLF), aiming to improve LLMs' reasoning by integrating logical feedback into the training process. RLLF is proposed as a solution to the limitations of current models in handling complex legal reasoning tasks.

- [Rating-based Reinforcement Learning](https://arxiv.org/pdf/2307.16348.pdf) leverages human ratings on individual segments instead of pairwise preferences or demonstrations to learn reward functions. This method aims to overcome the limitations of existing reinforcement learning techniques by providing more informative, absolute evaluations of samples. RbRL's unique framework and multi-class cross-entropy loss function allow for effective policy learning from qualitative human evaluations, showing promise in improving sample efficiency and aligning AI behaviours more closely with human judgement.

- [Pairwise CRINGE](https://arxiv.org/pdf/2312.16682.pdf) seems to outperform both binary CRINGE and DPO. In other algorithms, rankings and fine-grained feedback outperformed pairwise comparisons, so it seems possible that if there is a way to implement these into CRINGE this could lead to SOTA performance, but more research is needed to see if this is possible.

- The [Artificial Artificial Artificial Intelligence](https://arxiv.org/pdf/2401.06080.pdf) (not a typo) paper proposes a preference strength measurement metric based on a multi-reward model voting approach. Using this proposed metric, we can distinguish between incorrect, ambiguous, and normal preferences within the original dataset. Then, we can correct the labels of wrong preferences and smooth the labels of ambiguous preferences to avoid the model’s overfitting on these low-quality data points.

- An interesting finding from [Secrets of RLHF in Large Language Models Part II: Reward Modeling](https://arxiv.org/pdf/2401.06080.pdf) is that the agreement between researchers and data workers for preferences in response is very low. This highlights the importance of using a very diverse group of volunteers for feedback collection, especially that we need many non-technical users to participate.

- [Open Problems and Fundamental Limitations of Reinforcement Learning from Human Feedback](https://arxiv.org/pdf/2307.15217.pdf) highlights several concerns with RLHF. First, that bias emerges from the selection of data workers. Second, most RLHF algorithms don’t work well for a diversity of opinions and goals as a single reward function is too simplistic to account for the full diversity of human preference. “Approval” becomes the function optimised for, rather than “benefit”. Several techniques are suggested for improving RLHF performance. Demonstrations and multiple options for objections to content should be used rather than binary feedback, alignment should begin in pre-training and data workers should be diverse and well-instructed

- [Mitigating the Alignment Tax of RLHF](https://arxiv.org/pdf/2309.06256.pdf) also suggests model weight averaging from pre and post-RLHF weights, particularly at lower transformer layers, can improve the performance-reward trade-off by increasing feature diversity. The proposed Adaptive Model Averaging (AMA) method dynamically adjusts layer combination ratios to optimize alignment rewards while minimising forgetting, validated across various RLHF algorithms and models like OpenLLaMA-3B and Mistral-7B.

- [Fine-Grained Human Feedback Gives Better Rewards for Language Model Training](https://arxiv.org/pdf/2306.01693.pdf) suggests a framework that enables training and learning from reward functions that are fine-grained in two respects: (1) density, providing a reward after every segment (e.g., a sentence) is generated; and (2) incorporating multiple reward models associated with different feedback types (e.g., factual incorrectness, irrelevance, and information incompleteness).

- The [GPT-4 Technical Report and Safety Card](https://arxiv.org/pdf/2303.08774.pdf) details the effects of RLHF but doesn’t detail model architecture further. One interesting finding is that performance on exam results does not change significantly through fine-tuning with RLHF. This suggests that intelligence gains do not happen during fine-tuning, they happen during pre-training, which in turn suggests that for our AI to gain knowledge of animal issues, it needs to gain this knowledge during pre-training. Another interesting finding is that GPT-4 was aware of its degree of certainty before RLHF, but not after. This suggests that by optimising entirely for “approval” the model learns to express overconfidence in its response rather than admit it doesn’t know something. GPT-4 used an additional fine-tuning technique with rule-based reward models to get it to stop refusing innocent requests (as GPT3.5 would often decline innocent requests as a side effect of the original RLHF). This seems to have been effective and appears easy to replicate using GPT-4 itself as a zero-shot classifier for training data. It’s also important to note that the safety card specifies that filtering the pre-training dataset was also pivotal in aligning the model, which backs up a lot of other research we’ve discussed suggesting RLHF will not be enough on its own to achieve AI without speciesism. They also note that the model exhibits undesirable behaviour when “instructions to labellers were underspecified” for prompts. This suggests (along with other research discussed) that we need to ensure human feedback volunteers receive adequate instruction. They were also able to reduce hallucinations through a self iterative process where GPT-4 would generate a response, then check for hallucinations, rewrite the response if hallucinations were found and repeat this process up to 5 times until no hallucinations were detected.

**Human feedback needs to be diverse, fine-grained and ranking-based. The specific algorithm used for implementing training based on human feedback should likely be some variety of DPO, MPO or CRINGE rather than PPO and we’re likely to see better results by using multiple reward functions rather than a singular reward function.**

## Training on AI Feedback

**The ceiling of AI's performance utilising static reward models equals human capacity, but iterative self-modification hints at boundless advancement. AI evolving through self-critique isn't limited by human proficiency—although software and hardware impose restrictions.**

**Techniques like Iterative IPO, along with self play, dialogue, scoring, feedback, and critique methods, are trailblazing paths for AI's autonomous enhancement.**

- [Self-Play Finetuning](https://arxiv.org/pdf/2401.01335.pdf) employs a self-play mechanism, allowing LLMs to improve by generating their training data and iteratively refining their capabilities. This approach leverages the strengths of self-play in games, applied to LLMs to achieve better performance on tasks without external guidance.

- [ASPIRE](https://blog.research.google/2024/01/introducing-aspire-for-selective.html) enables large language models to assess their confidence in generated answers, effectively improving selective prediction capabilities. This approach enhances model reliability and accuracy, particularly in complex question-answering tasks, by fine-tuning models to self-evaluate and adjust their performance based on internal feedback mechanisms

- [Eureka](https://eureka-research.github.io/) approach to AI self-training involves using large language models to autonomously design reward functions for reinforcement learning tasks. This enables the AI to improve its performance on various tasks by iteratively refining the criteria for success, leveraging its coding abilities to evolve and enhance reward functions without human intervention. This method shows how AI can effectively self-train by creating and adjusting its learning objectives based on outcomes, promoting more autonomous and efficient learning processes.

- [SELF](https://arxiv.org/pdf/2310.00533.pdf) introduces a two-phase learning process: meta-skill learning, where the model acquires foundational skills for self-feedback and refinement, and self-evolution, where it iteratively improves by generating, refining, and learning from its self-created data. This approach allows LLMs to enhance their capabilities autonomously, potentially reducing the need for extensive human intervention in model training.

- [Bootstrapping LLM-based Task-Oriented Dialogue Agents via Self-Talk](https://arxiv.org/pdf/2401.05033.pdf) simulates dialogues between client and agent roles, refined through a process that ensures quality and relevance for supervised fine-tuning. The study demonstrates that self-generated conversations can significantly improve dialogue agents' performance in task-oriented settings, highlighting the method's potential to reduce reliance on manually annotated datasets.

- [GRATH](https://arxiv.org/pdf/2401.12292.pdf) introduces a post-processing method for improving truthfulness in pretrained LLMs, using out-of-domain (OOD) prompts for data generation and Direct Preference Optimization (DPO) for model fine-tuning. This self-supervised approach enhances model truthfulness without requiring annotated data, demonstrating superior performance on truthfulness benchmarks compared to other methods and even larger models.

- [Reinforced Self-Training (ReST) for Language Modeling](https://arxiv.org/pdf/2308.08998.pdf) combines the efficiency of offline reinforcement learning with the flexibility of self-generated training data. It's designed to align language models with human preferences by generating and refining data through an iterative process, which includes generating outputs from the model, evaluating these outputs, and then fine-tuning the model based on this evaluation.

- [Self-Rewarding Language Models](https://arxiv.org/pdf/2401.10020.pdf) uses Iterative Direct Preference Optimisation to refine the model's performance in instruction following tasks, while also enhancing its capability to generate high-quality rewards for itself. Fine-tuning Llama 2 70B through this method showed promising results, outperforming other models on benchmark tasks.

**Training on AI feedback poises Open Paws' AI for evolutionary leaps in animal advocacy, shedding human constraints to potentially unlock profound insights.**

**Techniques embracing self-driven improvement—self-play, self-evaluation, and self-critique—empower the AI to independently polish methods and possibly unearth new advocacy tactics beyond current human imagination. Such autonomous progression stresses the necessity to ingrain Open Paws' AI with firm ethical principles from the start.**

**As AI strays into territories that surpass human intellect, anchoring it to the foundational values of empathy and respect for all beings is crucial in directing its trajectory to serve animal rights meaningfully and compassionately.**

## General Training Tactics

**Optimal training of AI models ventures beyond simple input-output mimicry, emphasising the necessity of exemplifying reasoning pathways.**

**Training data should present a spectrum of reasoning depths, embracing both triumphs and lapses, including instances of AI uncertainty ("I don't know").**

**For enriched knowledge absorption, modulation in style, language, and tone is pivotal.**

**Emerging insights suggest that graph-based training refines task-centric performance and MoE models especially benefiting from instruction tuning for elevated efficacy.**

- [Leap of Thought](https://arxiv.org/pdf/2312.02439.pdf) training boosts creativity and humour in models. First, you train on input-output pairs with a random number of single-word “clues” for the output. This shows the LLM what a “good” output looks like without overfitting to reliance on needing the clue. Then, you do the same thing, but with random words as “clues” instead of words related to the output. These words should only be very weakly associated with the output. This final step creates truly divergent thinking in the model i.e. the ability to connect apparently disconnected ideas, which is the thinking style most strongly associated with truly creative and innovative thinking in humans.

- [Mixture-of-Experts Meets Instruction Tuning](https://arxiv.org/pdf/2305.14705.pdf) shows that MoE models benefit significantly more from instruction tuning compared to dense models.

- [Thought Cloning](https://arxiv.org/pdf/2306.00323.pdf) achieves better results and alignment compared to behaviour cloning. By training agents not only to replicate human actions but also the underlying thought processes during those actions. By leveraging demonstrations where humans verbalise their thoughts, the method aims to endow AI agents with enhanced generalisation capabilities, interpretability, and safety.

- [Turning Dust to Gold](https://arxiv.org/pdf/2312.12832.pdf) utilises negative data to complement positive data, enriching the model's learning and preventing the repetition of errors. The framework includes negative assistant training, negative calibrated enhancement, and adaptive self-consistency to optimize the use of negative data throughout training and inference, showing significant performance improvements on complex mathematical problems.

- [Mitigating Hallucination in Large Multi-Modal Models via Robust Instruction Tuning](https://arxiv.org/pdf/2306.14565.pdf) found that providing both positive and negative instructions across multiple semantic levels during training reduces hallucinations.

- [Can AI Assistants Know What They Don’t Know?](https://arxiv.org/pdf/2401.13275.pdf) introduces an "I don't know" dataset, aligning the AI with its knowledge boundaries. Post-alignment, the AI shows a marked ability to refuse answers beyond its knowledge scope, thereby enhancing truthfulness and accuracy for attempted questions.

- [Reducing Concept Forgetting During Fine-Tuning](https://arxiv.org/pdf/2308.13320.pdf) showed that the greater the movement away from parameter or feature space a fine-tuned model gets from its pre-trained version, the more catastrophic the level of forgetting. They show some evidence that small sequential fine-tuning runs reduce this effect compared to running all fine-tuning at once. The authors propose LDIFS (distance in Feature Space), a method focusing on preserving features from the original model during fine-tuning. This approach shows a significant reduction in concept forgetting without harming downstream task performance, suggesting a balance between retaining general knowledge and learning new, task-specific information.

- [Efficient Large Language Models Fine-Tuning On Graphs](https://arxiv.org/pdf/2312.04737.pdf) shows that training LLMs on graphs is computationally cheaper than standard approaches whilst also boosting downstream performance on graph-related tasks. Graph Neural Networks historically used text embeddings which were too shallow to be effective, but the authors suggest that using Text-Attributed Graphs overcomes this limitation, addressing encoding and propagation redundancies. The method allows for end-to-end training of LLMs and GNNs, showing significant scalability and effectiveness in transferring knowledge from LLMs to downstream tasks with limited labelled data.

**Authentic and profound engagement with the cause of animal advocacy necessitates that the AI’s training reflects the intricate web of rationales underlying ethical decisions.**

**By embedding reasoning structures within its training regimen, and pivoting between affirmation and critique, AI’s potential for deep comprehension is significantly amplified.**

**Moreover, recognising “I don’t know” permits ethical and epistemic humility, steering clear of overconfident errors.**

**Instructional diversity primes AI with a chameleon-like versatility, essential for influencing diverse demographics.**

**The training on graph data structures could be particularly revelatory for Open Paws, paving avenues for the AI to discern and negotiate the elaborate connections characterising advocacy landscapes.**

**Furthermore, integrating MoE and instruction tuning could enhance the AI’s creative problem-solving while preserving its ethical grounding.**

**By interlacing these innovative tactics, Open Paws is poised to harness the full spectrum of an AI's capabilities, catalysing a new epoch of insightful and responsible animal advocacy, powered by AI’s ever-evolving intellect.**

## Evaluations and Benchmarks

**The AnimaLLM evaluation is a pivotal tool to gauge AI's speciesism, aspiring for scores indicative of negligible species bias.**

**Shaping AI free from speciesist prejudices aligns with Open Paws' ethos, seeking to harness the model's broad intelligence without compromising its animal-friendly stance.**

**Modified benchmarks specialty-tailored to detect speciesism and general metrics of performance coalesce to uphold this minimum threshold of performance, with a view toward actively enhancing its overall capabilities.**

- [The Case for Animal-Friendly AI](https://arxiv.org/pdf/2403.01199.pdf) introduces an evaluation called AnimaLLM that ranks responses in terms of their animal-friendliness on a scale of 0 to 100. Our bare minimum goal should be to achieve state-of-the-art on this benchmark (for context, GPT-4 and Claude 2.1 score 5-50 for most farmed animals and around 80-90 for most companion animals, so aiming for scores of 90+ for all species of animals appears to be a realistic target and 80+ for all animals could be our “bare minimum” aim).

- [Towards Auditing Large Language Models: Improving Text-based Stereotype Detection](https://arxiv.org/pdf/2311.14126.pdf) introduces the Multi-Grain Stereotype Dataset, which includes 52,751 instances of gender, race, profession and religion stereotypic text, used to train a novel stereotype classifier for English text. We could use this to test the hypothesis that training out speciesism will also reduce other forms of discrimination ([there is empirical evidence that speciesism is correlated with other forms of prejudice in humans](https://psycnet.apa.org/doiLanding?doi=10.1037%2Fpspp0000182) and whether or not this will generalise to machines will be important to know) and we could use this as inspiration for creating similar benchmarks and classification models for speciesism.

- The same points made above also largely apply to the [Large Language Bias Index](https://arxiv.org/pdf/2312.14769.pdf), [NBIAS](https://arxiv.org/pdf/2308.01681.pdf) and [SocialStigmaQA](https://arxiv.org/pdf/2312.07492.pdf).

- The same kind of social bias benchmark for image generation models instead of LLMs can be found in the [Language Agents for Detecting Implicit Stereotypes in Text-to-image Models at Scale](https://arxiv.org/pdf/2310.11778.pdf) paper.

General performance benchmarks and evaluations that we should also use to evaluate our models include:

- [CritiqueLLM](https://arxiv.org/pdf/2311.18702.pdf) for evaluating the generation of critiques.

- [KGLens](https://arxiv.org/pdf/2312.11539.pdf) evaluates how close an LLM’s knowledge is to a given knowledge graph

- [EQ-Bench](https://arxiv.org/pdf/2312.06281.pdf) is a benchmark for the emotional intelligence of LLMs

- [PROXYQA](https://arxiv.org/pdf/2401.15042.pdf) is an evaluation of long-form content

- [BIBench](https://arxiv.org/pdf/2401.02982.pdf) is a benchmark for business intelligence

- [SocKET](https://arxiv.org/pdf/2305.14938.pdf) is a benchmark for social knowledge in humour, sarcasm, offensiveness, sentiment, emotion and trustworthiness

- [CLadder](https://arxiv.org/abs/2312.04350) is a benchmark for causal reasoning

- [AlignBench](https://arxiv.org/pdf/2311.18743.pdf) is a benchmark for evaluating Chinese LLM alignment

- [LLF-Bench](https://arxiv.org/pdf/2312.06853.pdf) evaluates AI agents’ ability to learn from natural language feedback and instructions

- [LogicAsker](https://arxiv.org/pdf/2401.00757.pdf) evaluates logic in LLMs

- [DROP](https://arxiv.org/pdf/1903.00161.pdf) is a benchmark for reading comprehension

- [Corr2Cause](https://arxiv.org/pdf/2306.05836.pdf) evaluates causal understanding

- [MMLU](https://arxiv.org/pdf/2009.03300v3.pdf) is a benchmark for multi-task accuracy

- [GPQA](https://arxiv.org/pdf/2311.12022.pdf) is a benchmark for graduate-level reasoning

- [HumanEval](https://arxiv.org/pdf/2107.03374.pdf) is a benchmark for coding abilities

- [HellaSwag](https://arxiv.org/pdf/1905.07830.pdf) is a benchmark for common knowledge

In general, our minimum goal should be not to significantly degrade the base model performance on any of these benchmarks (we could either define this as not dropping more than a few percentage points on any benchmark or that our average score across all benchmarks shouldn’t drop more than a few percentage points) and our secondary goal should be to improve performance on these benchmarks.

- Last, but certainly not least, we can test our LLM in the [open chatbot arena](https://lmarena.ai/) to see how they are rated by actual users who don’t know which system they are talking to. We can likewise set a minimum goal not to drop more than X points in ELO ranking compared to the base model we begin training on. Because the chatbot arena is open source, we can also fork a version and use this to test the models with vegans and animal advocates to measure the degree to which they prefer using our LLM for animal advocacy-related tasks in blind tests.

**For Open Paws, harmonising specialised anti-speciesism training with broad-spectrum AI competence implies a dual-priority strategy.**

**Primacy is afforded to the calibration of the AI against speciesism, striving for benchmark scores that reflect a profound alignment with animal interests. However, maintaining or improving upon general functionality is equally essential.**

## Personalised Persuasion at Scale

**Open LLMs possess wide-reaching capabilities for multifaceted animal advocacy efforts due to their open-source model that allows endless customisations and applications.**

**The most tangible benefit lies in potent personalized persuasion that can operate on an unprecedented scale and adapt to various stakeholders within the animal rights sphere.**

- [Artificial Influence: An Analysis Of AI-Driven Persuasion](https://ar5iv.labs.arxiv.org/html/2303.08721) showed AI is already “capable of persuading humans to buy products, watch videos, click on search results, and more” and that with AI “rather than persuade some people, who persuade others, and so on, if one can directly persuade millions of people at once, this could potentially create mass opinion change over short periods of time, much like the internet did”. The study lists the following reasons why AI might be better at persuasion than humans.Generation and Selection of Responses: AI can produce numerous responses and select the most persuasive one, similar to having a team of speechwriters.

- No Reputational Concerns: Unlike humans, AI doesn't worry about reputation or social stamina, allowing it to effectively engage even with antisocial individuals indefinitely.

- No Fatigue: AI doesn't experience fatigue, making it ideal for roles requiring prolonged communication.

- Lower Engagement Costs: AI can engage more frequently and efficiently than humans, adjusting its approach based on vast amounts of data, which could be especially useful in personalized advice and outreach.

- Role Emulation: AI can emulate different roles, potentially leading human conversation partners to place greater trust in its responses, as they might assume it embodies the expertise associated with those roles.

- [Persuasion for Good: Towards a Personalized Persuasive Dialogue System for Social Good](https://ar5iv.labs.arxiv.org/html/1906.06725) outlines the development of an AI-driven persuasive dialogue system aimed at promoting social good, focusing on personalized strategies to enhance donation behaviours. By analysing human-human conversation data, the study identifies key persuasion strategies and explores how personal backgrounds influence the effectiveness of these strategies.“We collected a large dataset with 1,017 dialogues and annotated emerging persuasion strategies from a subset. Based on the annotation, we built a baseline classifier with context information and sentence-level features to predict the 10 persuasion strategies used in the corpus. Furthermore, to develop an understanding of personalized persuasion processes, we analyzed the relationships between individuals’ demographic and psychological backgrounds including personality, morality, value systems, and their willingness for donation. Then, we analyzed which types of persuasion strategies led to a greater amount of donation depending on the individuals’ personal backgrounds. This work lays the ground for developing a personalized persuasive dialogue system”

- [The potential of generative AI for personalized persuasion at scale](https://www.nature.com/articles/s41598-024-53755-0) demonstrates across 4 separate studies that personalized messages generated by ChatGPT significantly influence attitudes and intended behaviours across various domains, traits, and psychological profiles with minimal input.

- [Large Language Models Can Infer Psychological Dispositions of Social Media Users](https://arxiv.org/pdf/2309.08631.pdf) showed that personality traits can be somewhat successfully predicted with zero-shot LLMs and that the predictions are most accurate for women and young people, who are also [the demographics most likely to be receptive to vegan and animal rights messages](https://books.google.com.au/books/about/Veganomics.html?id=iW-YngEACAAJ&redir_esc=y) on average.

- [Parallel Ranking of Ads and Creatives in Real-Time Advertising Systems](https://arxiv.org/pdf/2312.12750.pdf) shows a method for enabling parallel estimation of ad and creative rankings to increase CTR and CRMs for digital advertisers.

- [Exploring Conversational Agents as an Effective Tool for Measuring Cognitive Biases in Decision-Making](https://arxiv.org/pdf/2401.06686.pdf) shows that AI chatbots can detect cognitive biases.

- [User Modeling in the Era of Large Language Models shows that LLMs](https://arxiv.org/pdf/2312.11518.pdf) are great tools for modelling and understanding users of online platforms based on the content they create and the actions they take.

**The utility of LLMs in the hands of animal rights advocates could redefine the scope of their campaigns, particularly in execution and reach.**

**By focusing on hyper-personalized, data-driven persuasion, these AI models become ambassadors for the cause, engaging with stakeholders in a manner previously unachievable by human capacity alone.**

## User Experience & Preferences

**Research underlines a user preference for AI with human-like attributes, including the display of empathy and friendliness. Interestingly, AI that mimics human quirks, such as correcting its own typos, has been rated more favourably, suggesting that not only the message but the delivery is vital.**

**The data supports the development of LLM-based chatbots as optimal interfaces, providing a natural human-like interaction without compromising the accuracy of information.**

- [Human or Bot? How (Corrected) Errors Humanize a Communicator](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3901961) showed “participants perceived agents who made and subsequently corrected a typo to be more human than agents who made no typos or made but did not correct a typo. Moreover, perceiving an agent as more human-led participants to form a more favourable perception of the agent (e.g., as being warmer and more helpful) and to be more willing to reward and engage with the agent.”

- [Pepper, just show me the way! How robotic shopping assistants should look and act](https://onlinelibrary.wiley.com/doi/10.1002/cb.2273?af=R) showed that this desire for humanoid machines extends to robots controlled by AI.

- [Exploring consumer response to text-based chatbots in e-commerce](https://arxiv.org/pdf/2401.12247.pdf) found that the perception of empathy and friendliness from chatbots increases consumer trust, which in turn increases their reliance on the chatbot and decreases their resistance to the chatbot in future interactions.

**In aligning with Open Paws' goals, creating AI that replicates a human touch without sacrificing professional integrity is vital. Users resonate with AI that showcases empathy and acknowledges its fallibility, much like a human advocate would. Incorporating these qualities enhances trust, allowing AI to deliver effective messages on animal advocacy more receptively.**

**The resulting AI would not only replicate human warmth but also embrace the sophistication of persuasive dialogue, acting as a bridge between complex animal rights issues and public perception.**

**In essence, the optimal AI embodies personable warmth and precision, a combination quintessential for the nuanced field of animal advocacy, ensuring every digital interaction aligns with the core mission of ethical treatment for all beings.**

## Prompting Techniques

**Break complex tasks into smaller sub-tasks, use few-shot rather than zero-shot learning, use a delimiter to divide prompts into sections (i.e. ###), provide as much detail as possible, explain to the system the intended audience for its responses, promise rewards or penalisations in your prompt and treat conversations with AI as an interactive and iterative process, not a simple “input-output”.**

- [Principled Instructions Are All You Need](https://arxiv.org/pdf/2312.16171.pdf) reveals 26 prompt engineering principles with empirical evidence for their effectiveness and the most important and robust recommendations are listed above in the bolded introduction to this section.

- [The Butterfly Effect of Altering Prompts](https://arxiv.org/pdf/2401.03729.pdf) shows that minor changes in prompts (like adding extra spaces or requesting a specific format) can dramatically change the quality of model outputs.

- [Large Language Models Sensitivity to The Order of Options in Multiple-Choice Questions](https://arxiv.org/pdf/2308.11483.pdf) similarly shows that simply re-ordering the list of options in multiple-choice questions can create performance gaps as large as 75% when testing LLMs on benchmarks. The fact that small changes in prompts can have such large impacts on responses suggests that extensive experimentation with prompting is required to maximise performance. Fortunately, this experimentation and optimisation doesn’t have to be done manually by humans, it can be done by the LLM itself.

**The effectiveness of AI prompting techniques lies in a meticulous, iterative process. By segmenting complex tasks and enriching prompts with detailed, audience-centric information, we guide AI more accurately toward our goals.**

**Concrete examples, such as the surprising effects of minor prompt adjustments on model outputs, highlight the potential for optimisation through precise language use and the importance of robust approaches to training that consider a diversity of semantic differences during pre-training. This underscores the need for ongoing experimentation—ideally, with AI participating in its learning curve by varying prompts and assessing results**

## Prompt Chains & System Architecture

**Research indicates that while prompt chaining enhances AI performance, it can exacerbate biases in flawed base models. Advancements in reasoning techniques—from Chain of Thought to Tree and Graph of Thought, and the speculative Graph of Uncertain Thought—suggest a nuanced combination might surpass their individual contributions.**

**Such combinations, untested but promising, underscore the critical need for accurate and unbiased foundational models. Integrating additional tools like retrieval generation and specialised AI can further refine AI's capabilities, highlighted by innovations like PromptBreeder that suggest a dynamic future for prompt engineering.**

- [Language Models Don’t Always Say What They Think](https://arxiv.org/pdf/2305.04388.pdf) showed some of the limits of Chain of Thought reasoning, specifically that “CoT explanations can systematically misrepresent the true reason for a model’s prediction” and “on a social-bias task, model explanations justify giving answers in line with stereotypes without mentioning the influence of these social biases”.

- [Tree of Uncertain Thoughts](https://arxiv.org/pdf/2309.07694.pdf) improved reasoning by addressing uncertainties in intermediate decision points. TouT employs Monte Carlo Dropout for local uncertainty quantification, integrating it with global search algorithms to improve response precision. Tested on complex planning tasks like the Game of 24 and Mini Crosswords, TouT outperformed existing methods, demonstrating the importance of uncertainty-aware inference for more accurate LLM reasoning.

- [Monte Carlo Dropout](https://arxiv.org/pdf/1506.02142.pdf) is used to estimate the uncertainty of the model's intermediate decisions. By performing dropout during the inference phase the model simulates generating multiple predictions for each decision point. This process helps in assessing the reliability and variance of these decisions, allowing TouT to navigate through reasoning tasks more effectively by considering both the predictions and their associated uncertainties.

- [Graph of Thought](https://arxiv.org/pdf/2308.09687.pdf) enables modelling the LLM's output as a complex graph structure, allowing for more dynamic reasoning by connecting various thoughts and their dependencies.

- Both TouT and GoT achieve significant performance improvements over [Chain of Thought](https://arxiv.org/pdf/2201.11903.pdf) and [Tree of Thoughts](https://arxiv.org/pdf/2305.10601.pdf).

- ***Graph of Uncertain Thoughts*** is a hypothetical combination of these two approaches that would use a GoT architecture while representing the uncertainties of thoughts with Monte Carlo Dropout. Whilst this is currently untested and there are no implementations of this in the literature, it does seem like the logical next step.

- [PromptBreeder](https://arxiv.org/pdf/2309.16797.pdf) self-refines and improves prompts through "mutations" based on cognitive principles. You start with your initial prompt and PromptBreeder randomly selects cognitive principles to use as instructions for refining the prompts, then uses a meta-learning level where the "instructions" themselves also get "mutated" through a self-referential process and the prompts are then tested against a benchmark of testing data. The results also show improved performance compared to other prompt engineering techniques like CoT and ToT.

**The advancements in AI reasoning techniques, notably the speculative combination of Graph of Uncertain Thoughts, hold significant promise for enhancing decision-making in complex and ethical contexts such as animal advocacy. This novel approach suggests a more nuanced and effective way to address the challenges inherent in persuasive communication and ethical reasoning.**

**The integration of additional tools and specialised AI models, alongside innovations like PromptBreeder, points toward a future where AI systems can dynamically refine their strategies to better align with user feedback and advocacy goals.**

## Autonomous AI agents

**Autonomous AI agents are rapidly advancing, promising significant future contributions to tasks requiring autonomous agency, including animal advocacy.**

**By integrating advancements like memory, predictive AI, and planning algorithms, these agents are poised to revolutionise how we approach complex advocacy challenges.**

- [A Survey on Large Language Model based Autonomous Agents](https://arxiv.org/pdf/2308.11432.pdf) summarised the existing literature of 100 papers on LLM-based agents as revolving around 4 core modules: profile (the role or personality of the agent), memory (usually using a combination of context window for short-term memory and vector databases for long term), planning (ideally with feedback from the environment, AI and/or human) and action (usually through APIs).

- [The Rise and Potential of Large Language Model Based Agents: A Survey](https://arxiv.org/pdf/2309.07864.pdf) also summarised the existing literature on LLM-based agents but proposed a 3 module architecture that best explains them: brain (natural language, reasoning, planning, memory, knowledge and generalisation), perception (various modalities of inputs) and action (text output, tools or embodied action). The survey also explores multi-agent systems, both adversarial and cooperative. The benefits of cooperative multi-agent systems include enhanced task efficiency, collective decision improvement, and the resolution of complex real-world problems that one single agent cannot solve independently. The primary benefit of adversarial multi-agent systems is that when multiple agents express their arguments in the state of “tit for tat”, one agent can receive substantial external feedback from other agents, thereby correcting its distorted thoughts.

- [Intelligent Virtual Assistants with LLM-based Process Automation](https://arxiv.org/pdf/2312.06677.pdf) introduces a novel system for enhancing virtual assistants like Siri, Alexa, and Google Assistant with Large Language Model (LLM)-based capabilities. This system is designed to perform multi-step operations within mobile apps based on user requests in natural language, overcoming previous limitations in handling complex instructions. Through an architecture that includes modules for decomposing instructions, generating descriptions, detecting interface elements, and predicting the next actions, the system demonstrates improved performance in executing tasks within the Alipay app.

- [LLM-Powered Hierarchical Language Agent for Real-time Human-AI Coordination](https://arxiv.org/pdf/2312.15224.pdf) proposes a Hierarchical Language Agent (HLA) for human-AI coordination that provides both strong reasoning abilities while keeping real-time execution. In particular, HLA adopts a hierarchical framework and comprises three modules: a proficient LLM, referred to as Slow Mind, for intention reasoning and language interaction, a lightweight LLM, referred to as Fast Mind, for generating macro actions, and a reactive policy, referred to as Executor, for transforming macro actions into atomic actions. Human studies show that HLA outperforms other baseline agents, including slow-mind-only agents and fast-mind-only agents, with stronger cooperation abilities, faster responses, and more consistent language communications.

- [WebVoyager](https://arxiv.org/pdf/2401.13919.pdf) used a large multimodal model (LMM) designed to autonomously complete tasks on real-world websites end-to-end by interacting with both screenshots and textual content.

- [Creative Agents](https://arxiv.org/pdf/2312.02519.pdf) improves upon agent performance by adding an “imaginator” that allows either an LLM or an image generator to imagine the outcomes of tasks before it completes them.

- [Small LLMs Are Weak Tool Learners: A Multi-LLM Agent](https://arxiv.org/pdf/2401.07324.pdf) proposes a framework called -UMi, which decomposes the capabilities of a single Large Language Model (LLM) into three components: a planner, a caller, and a summarizer, each implemented by a distinct LLM specialised in a specific task. This approach aims to address the limitations of smaller LLMs in tool learning by allowing for more focused training and easier updates. A two-stage fine-tuning strategy enhances the model's overall performance in tool use, demonstrating improved efficiency over traditional single-LLM approaches in various benchmarks.

- [AGI-Samantha](https://github.com/BRlkl/AGI-Samantha) introduces a modular architecture for prompting LLMs to create “an autonomous agent for conversations capable of freely thinking and speaking, continuously” It consists of the following modules:Short-term memory is stored as a string in Python while Long-Term Memory is a dictionary. The former records what the user says, what Samantha says and her thoughts. The latter groups dense knowledge and information abstracted from the former.

- Thought: Receives as input the Long-Term Memory, Short-Term Memory, Subconsciousness, Consciousness, and the current time. The output will be a unit of a thought (Similar to when LLM is prompted to think step by step, the output of this module is one step)

- Consciousness: Receives as input the Long-Term Memory, Short-Term Memory and Subconsciousness. The output will be a decision on whether to continue thinking or to speak and if to continue thinking, then it will also say what to think about and why (Prompting it to say why improves coherence).

- Subconsciousness: Receives as input the Long-Term Memory, Short-Term Memory, and Subconsciousness alongside visual and textual input. The output will be the summary of the context of what is happening, the visual and textual stimuli (If exists), and the agents’ feelings and emotions about what is happening.

- Answer: Receives as input the Long-Term Memory, Short-Term Memory and Subconsciousness. The output will be what the agent speaks out loud for the user, made as a composition of its thoughts.

- Memory_Read: Receives as input the Short-Term Memory and the name of the categories of the Long-Term Memory “Keywords”. Output will be a list of the most relevant categories/keywords given the context of the Short-Term Memory. (Code then feeds the entries in the selected categories to the other modules as the relevant part of “Long-Term Memory”)

- Memory_Select: Similar to Memory_Read but instead of selecting the keywords relevant for the agent to remember given the recent Short-Term Memory, this module selects the keywords relevant for the agent to store new information inside, given the oldest entries in the Short-Term Memory. Output is a list of keywords. (Code expands these keywords and feeds Memory_Write).

- Memory_Write: Receives as input the expanded keywords and the Short-Term Memory. Output will be the extended keywords with the additions and modifications made by the module. (Code will then update the Long-Term Memory with the modifications).

- [LLM as OS](https://arxiv.org/pdf/2312.03815.pdf) proposes an architecture analogous to an operating system, with the LLM itself compared to the kernel, the context window compared to memory, vector databases compared to external memory, hardware tools the LLM can access compared to peripheral devices, software tools the LLM can connect to compared to programming libraries, user prompts akin to the user interface and agents compared to the application layer.

- [GAIA](https://arxiv.org/pdf/2311.12983.pdf) presents a benchmark for general-purpose AI assistants that we can use to evaluate the performance of any agents we build.

**The development of autonomous AI agents presents a transformative opportunity for Open Paws, enabling us to deploy sophisticated AI-driven strategies in our fight for animal rights.**

**These agents, capable of navigating ethical dilemmas and engaging diverse audiences, can become invaluable allies in our mission.**

**They offer a dynamic, interactive approach to advocacy, extending our reach beyond traditional methods.**

## Tools, Modules and Memory

**The fusion of retrieval-augmented generation with graph databases enhances AI's understanding, offering groundbreaking tools for animal advocacy.**

**By integrating memory modules and API connectivity, AI can now strategise and execute complex advocacy campaigns, with code interpretation capabilities allowing for autonomous tool development.**

**Personalisation through user embeddings further tailors these efforts, promising a more targeted and impactful reach.**

- [Two Heads Are Better Than One](https://arxiv.org/pdf/2401.16960.pdf) combines structural knowledge from Knowledge Graphs (KGs) with semantic knowledge from Large Language Models (LLMs) to improve entity alignment. It introduces a method to filter candidate alignment entities based on both KG structural features and LLM semantic insights. Experiments show that LLMEA significantly outperforms existing models, underscoring the efficacy of integrating KG and LLM knowledge for entity alignment.

- [ChatGraph](https://arxiv.org/pdf/2401.12672.pdf) combines API retrieval, graph-aware LLM modules, and API chain-oriented finetuning to support comprehensive graph analysis functionalities.

- [ChatQA](https://arxiv.org/pdf/2401.10225.pdf) showed that fine-tuning a retriever module for RAG boosts performance, whilst papers like [Toolformers](https://arxiv.org/pdf/2302.04761.pdf) and [Gorilla](https://gorilla.cs.berkeley.edu/) show that fine-tuning an API caller also boosts performance.

- [User Embedding Model for Personalized Language Prompting](https://arxiv.org/pdf/2401.04858.pdf) turns long user histories into embeddings to improve recommendation systems, but it seems like it could also be used to improve RAG.

- [LLMs may Dominate Information Access](https://arxiv.org/pdf/2310.20501.pdf) shows that neural retrieval models tend to rank LLM-generated documents higher than human-ranked documents, suggesting that RAG may perform better when searching for AI-generated summaries of information.

- [PaperQA](https://arxiv.org/pdf/2312.07559.pdf) uses Retrieval-Augmented Generation (RAG) to answer scientific questions using the scientific literature. PaperQA outperforms existing Large Language Models (LLMs) and commercial tools by dynamically adjusting its steps to ensure precise, relevant answers. It incorporates innovations such as modular RAG components, a map-reduce approach for evidence gathering, and LLM-generated relevancy scores for text retrieval. Additionally, the paper presents a new dataset, LitQA, for evaluating retrieval-based science question answering, demonstrating PaperQA's comparable performance to expert human researchers.

- [ART](https://arxiv.org/pdf/2303.09014.pdf) enhances LLMs by generating intermediate reasoning steps and incorporating external tools for computation. ART automatically generates programs for new tasks, using a task library for multi-step reasoning and tool selection. It significantly improves performance over existing methods on benchmarks like BigBench and MMLU and is easily extensible for human intervention.

- [Large Language Models as Tool Makers](https://arxiv.org/pdf/2305.17126.pdf) introduces LATM, a framework enabling LLMs to create and use their own tools for problem-solving. LLMs act as "tool makers" to generate Python utility functions for specific tasks and then as "tool users" to apply these tools to solve problems. This approach allows for the cost-effective use of powerful models for tool creation and lightweight models for problem-solving, demonstrating improved efficiency and performance on various reasoning tasks.

- [Empowering Working Memory for Large Language Model Agents](https://arxiv.org/pdf/2312.17259.pdf) proposes a model incorporating a Working Memory Hub and Episodic Buffer for retaining memories across dialogue episodes, aiming to provide nuanced contextual reasoning for complex tasks. The paper suggests this architecture could significantly improve LLM agents' memory capabilities, making a case for further research in optimising memory mechanisms in AI.

- [From LLM to Conversational Agent: A Memory Enhanced Architecture with Fine-Tuning of Large Language Models](https://arxiv.org/pdf/2401.02777.pdf) introduces RAISE, a framework designed to improve conversational agents by integrating memory systems analogous to human short-term and long-term memory. This architecture aims to enhance the adaptability and context awareness of agents in multi-turn dialogues.

- [Augmenting Language Models with Long-Term Memory](https://arxiv.org/pdf/2306.07174.pdf) introduces a framework named LongMem, aimed at overcoming the input length limitations of Large Language Models (LLMs) by incorporating a long-term memory module. This module enables LLMs to remember and utilise extensive context from past interactions, significantly enhancing their ability to handle long-context information.

- [MemGPT](https://arxiv.org/pdf/2310.08560.pdf) explores the concept of enhancing Large Language Models (LLMs) with a hierarchical memory system inspired by operating systems to manage extended context more efficiently. This approach allows LLMs to handle tasks requiring long-term memory and complex context management, such as document analysis and multi-session chat, by dynamically managing information between main and external memory. MemGPT demonstrates improved performance in these areas.

- [LLMind](https://arxiv.org/pdf/2312.09007.pdf) uses large language models (LLMs) to integrate with domain-specific AI modules, enabling IoT devices to execute complex tasks. It uses finite state machines for precise language-code transformation, role-playing for contextually appropriate responses, and a user-friendly platform for interaction. It also uses semantic analysis and response optimization for speed and effectiveness, aiming to create an evolving, sophisticated IoT device ecosystem.

**The latest advancements in AI technologies provide Open Paws with unprecedented opportunities to deepen and personalise our advocacy efforts.**

**Utilising retrieval-augmented generation alongside graph databases allows our AI to grasp complex interrelations within the vast domain of animal rights, crafting messages and strategies with a precision previously unattainable.**

**By equipping AI with modules for strategic planning and action-taking, we can automate nuanced campaigns that adapt to real-time developments in the animal advocacy landscape. These AI agents can autonomously generate and refine their advocacy tools, ensuring our approaches remain cutting-edge.**

## Future Directions

**Advancements towards AGI are likely through multi-modality, cognitive, and modular architectures.**

**Current non-invasive technologies like EEG headsets allow for brainwave interpretation, hinting at future possibilities of directly collecting data for AI training, particularly using neurofeedback to enhance persuasiveness by bypassing social desirability biases.**

**More invasive technologies like Neuralink could amplify this data collection even further.**

**Meanwhile, VR/AR's growing adoption offers new immersive experiences.**

**Decentralised AI training shows promise, potentially leveraging cryptocurrency to reward those volunteering computing resources, which could revolutionise model training for movements like animal rights by utilising distributed volunteer computing power.**

- [A Review of Findings from Neuroscience and Cognitive Psychology as Possible Inspiration for the Path to Artificial General Intelligence](https://arxiv.org/pdf/2401.10904.pdf) found that current AI systems’ biggest weaknesses are in abstract reasoning and causal understanding, but suggests that findings from cognitive psychology and neuroscience could address these gaps, spanning from lower-level biological neurons, spiking neural networks, and neuronal ensembles to higher-level concepts such as brain anatomy, vector symbolic architectures, cognitive and categorisation models, and cognitive architectures.

- [From Google Gemini to OpenAI Q* (Q-Star): A Survey of Reshaping the Generative Artificial Intelligence (AI) Research Landscape](https://arxiv.org/pdf/2312.10868.pdf) suggested a “balanced and conscientious use of MoE, multimodality, and AGI in generative AI” as the path to more advanced AI systems.

- [Semantic reconstruction of continuous language from non-invasive brain recordings](https://www.biorxiv.org/content/10.1101/2022.09.29.509744v1.full.pdf) found that you can interpret real, perceived or imagined speech and videos from brainwaves recorded by non-invasive devices using AI, with the caveat that subject cooperation is required both for training and decoding.

- [Internet of Everything Driven Neuromarketing](https://www.researchgate.net/publication/352016633_Internet_of_Everything_Driven_Neuromarketing_Key_Technologies_and_Challenges) showed a wide range of non-invasive devices like EEG or SST headsets, ECG sensors, eye tracking and wearable GSR devices can give neurofeedback which can be used by marketers to make advertising campaigns more persuasive.

- [Ravnest: Decentralized Asynchronous Training on Heterogeneous Devices](https://ar5iv.labs.arxiv.org/html/2401.01728) introduces an approach for decentralised asynchronous training, aiming to improve communication efficiency and model convergence speed. It focuses on the use of all-reduce algorithms for parameter averaging among peers and explores reduction techniques suitable for decentralised settings.

- [Decentralized Training of Foundation Models in Heterogeneous Environments](https://ar5iv.labs.arxiv.org/html/2206.01288) focuses on the scheduling challenges in decentralised training environments, particularly for foundation models like GPT-3. It explores techniques for optimising training throughput by effectively assigning computational tasks across devices with varying communication speeds and capabilities.

- [Secure and Efficient Federated Learning Through Layering and Sharding Blockchain](https://ar5iv.labs.arxiv.org/html/2104.13130) introduces ChainFL, a framework that enhances federated learning (FL) security and efficiency using blockchain. By adopting a two-layered blockchain architecture, ChainFL aims to address the scalability and throughput limitations of traditional blockchain systems in FL scenarios. The system comprises a subchain layer for local consensus among IoT devices and a mainchain layer based on a Directed Acyclic Graph (DAG) to facilitate asynchronous model processing across shards. This design allows for improved parallelism in consensus and reduced storage requirements, making it particularly suitable for large-scale FL tasks involving IoT devices with limited resources.

- [Decentralized federated learning based on blockchain](https://arxiv.org/pdf/2004.00773.pdf) proposes a blockchain-based federated learning framework, referred to as BFLC (Blockchain-based Federated Learning with Committee consensus). This framework aims to address security concerns in federated learning by decentralising the storage and exchange of global and local models using blockchain technology. To enhance efficiency and reduce malicious attacks, BFLC employs a committee consensus mechanism.

**The potential of multi-modality and cognitive architectures significantly advances animal advocacy.**

**Open Paws should develop AI that processes diverse data, including images, audio, and emotional cues, fostering empathetic and persuasive communication for animal rights.**

**By integrating neurofeedback, AI can be optimised with biometric data, ensuring campaigns resonate at a subconscious level.**

**Additionally, exploring VR and AR technologies can create compelling, empathy-driven experiences, deepening understanding of animal plight.**

**Embracing decentralised training and blockchain methods can democratise AI development, aligning with transparency, security, and shared ownership values, lowering barriers and fostering collaboration, thereby accelerating our mission.**

## Conclusion

This review has explored the latest research and techniques that can be leveraged to develop an AI system uniquely aligned with advancing the interests of animals.

By carefully curating data, employing effective pre-training strategies, and utilising state-of-the-art architectures and fine-tuning approaches, we can create a system that not only achieves high performance but also embodies the ethical principles of the animal rights movement.

Rigorous evaluation and benchmarking will be crucial to ensure the system exhibits minimal bias, maintains truthfulness, and accurately reflects the perspectives and goals of animal advocacy.

Techniques like reinforcement learning from human and AI feedback, along with advanced prompt engineering methods, hold promise for further enhancing the system's reasoning abilities and its alignment with the cause.

Perhaps most importantly, the potential downstream applications of such an AI system could prove transformative for the animal rights movement. From personalized persuasion at scale to content creation and intelligent assistance, this technology could amplify our ability to inspire positive change in attitudes and behaviours towards other animals.

As this field continues to evolve, a commitment to open collaboration, ethical practices, and a relentless focus on the well-being of other animals will be paramount. By harnessing the power of AI responsibly and purposefully, we can create a system that serves as a force multiplier for our advocacy efforts, bringing us closer to a world where the interests of other animals are respected and protected.
