const fs = require('fs');
const path = require('path');

const words = [
  ['Achieve', '/əˈtʃiːv/', 'verb', 'To successfully reach a goal after effort.', 'She achieved fluency in six months.', 'Goals, work, and learning apps.', 'Present: achieve · Past: achieved · Past participle: achieved', ['accomplish', 'reach', 'attain']],
  ['Benefit', '/ˈbenɪfɪt/', 'noun', 'An advantage or helpful effect.', 'Daily practice has many benefits.', 'Health, jobs, and education discussions.', 'Plural: benefits', ['advantage', 'gain', 'profit']],
  ['Confident', '/ˈkɒnfɪdənt/', 'adjective', 'Feeling sure about your abilities.', 'He feels confident speaking English.', 'Interviews, presentations, and motivation.', 'Comparative: more confident · Superlative: most confident', ['sure', 'bold', 'self-assured']],
  ['Develop', '/dɪˈveləp/', 'verb', 'To grow or improve over time.', 'They developed strong listening skills.', 'Skills, cities, and personal growth.', 'Present: develop · Past: developed · Gerund: developing', ['grow', 'improve', 'build']],
  ['Effort', '/ˈefət/', 'noun', 'Physical or mental energy used to do something.', 'Learning English requires consistent effort.', 'School, sports, and teamwork.', 'Countable: efforts (tries)', ['attempt', 'work', 'exertion']],
  ['Fluent', '/ˈfluːənt/', 'adjective', 'Able to speak a language easily and accurately.', 'She is fluent in English and Hindi.', 'Language learning and job profiles.', 'Noun form: fluency', ['smooth', 'natural', 'proficient']],
  ['Grateful', '/ˈɡreɪtfəl/', 'adjective', 'Feeling thankful for something received.', 'I am grateful for your help.', 'Thank-you messages and daily conversation.', 'Adverb: gratefully', ['thankful', 'appreciative']],
  ['Improve', '/ɪmˈpruːv/', 'verb', 'To become better than before.', 'Your pronunciation is improving quickly.', 'Feedback, coaching, and study.', 'Present: improve · Past: improved', ['enhance', 'upgrade', 'refine']],
  ['Knowledge', '/ˈnɒlɪdʒ/', 'noun', 'Information and understanding gained through learning.', 'Reading builds knowledge.', 'Academic and professional talk.', 'Uncountable noun', ['understanding', 'wisdom', 'expertise']],
  ['Motivate', '/ˈməʊtɪveɪt/', 'verb', 'To encourage someone to take action.', 'Good teachers motivate their students.', 'Coaching, leadership, and goals.', 'Present: motivate · Past: motivated', ['inspire', 'encourage', 'drive']],
  ['Opportunity', '/ˌɒpəˈtjuːnəti/', 'noun', 'A good chance to do something useful.', 'This app is a great opportunity to practice.', 'Career, travel, and networking.', 'Plural: opportunities', ['chance', 'opening', 'prospect']],
  ['Practice', '/ˈpræktɪs/', 'noun / verb', 'Repeated exercise to build skill.', 'Practice speaking every day.', 'Language learning (always).', 'Verb: practice · Past: practiced', ['rehearse', 'train', 'exercise']],
  ['Respect', '/rɪˈspekt/', 'noun / verb', 'Admiration for someone or something.', 'Show respect in group discussions.', 'Culture, workplace, and values.', 'Verb: respect · Past: respected', ['honor', 'regard', 'esteem']],
  ['Succeed', '/səkˈsiːd/', 'verb', 'To achieve the result you wanted.', 'You will succeed if you stay consistent.', 'Goals and encouragement.', 'Present: succeed · Past: succeeded', ['triumph', 'win', 'accomplish']],
  ['Understand', '/ˌʌndəˈstænd/', 'verb', 'To know the meaning of something.', 'I understand the lesson now.', 'Classroom and chat (very common).', 'Present: understand · Past: understood', ['comprehend', 'grasp', 'follow']],
  ['Adapt', '/əˈdæpt/', 'verb', 'To change to fit new conditions.', 'Learners adapt to new accents quickly.', 'Travel, work abroad, and culture.', 'Present: adapt · Past: adapted', ['adjust', 'modify', 'accommodate']],
  ['Brave', '/breɪv/', 'adjective', 'Ready to face difficulty or danger.', 'It is brave to speak a new language publicly.', 'Stories, compliments, and challenges.', 'Noun: bravery', ['courageous', 'bold', 'fearless']],
  ['Challenge', '/ˈtʃælɪndʒ/', 'noun', 'Something difficult that tests ability.', 'Grammar is a fun challenge.', 'Games, fitness, and learning.', 'Verb: challenge · Past: challenged', ['difficulty', 'test', 'obstacle']],
  ['Decide', '/dɪˈsaɪd/', 'verb', 'To make a choice after thinking.', 'They decided to join the English club.', 'Plans and daily choices.', 'Present: decide · Past: decided', ['choose', 'determine', 'resolve']],
  ['Encourage', '/ɪnˈkʌrɪdʒ/', 'verb', 'To give support or confidence.', 'Friends encourage each other to speak.', 'Teaching, parenting, and teams.', 'Present: encourage · Past: encouraged', ['support', 'inspire', 'cheer on']],
  ['Focus', '/ˈfəʊkəs/', 'verb / noun', 'To concentrate attention on one thing.', 'Focus on one new word each day.', 'Study tips and productivity.', 'Present: focus · Past: focused', ['concentrate', 'center', 'attend']],
  ['Generous', '/ˈdʒenərəs/', 'adjective', 'Willing to give more than expected.', 'She is generous with her time.', 'Character and compliments.', 'Adverb: generously', ['kind', 'giving', 'charitable']],
  ['Honest', '/ˈɒnɪst/', 'adjective', 'Telling the truth and not cheating.', 'Be honest about your English level.', 'Trust and feedback.', 'Noun: honesty', ['truthful', 'sincere', 'fair']],
  ['Imagine', '/ɪˈmædʒɪn/', 'verb', 'To form a picture or idea in the mind.', 'Imagine yourself speaking fluently.', 'Creativity and motivation.', 'Present: imagine · Past: imagined', ['picture', 'visualize', 'suppose']],
  ['Journey', '/ˈdʒɜːni/', 'noun', 'The process of traveling or growing over time.', 'Language learning is a long journey.', 'Motivation posts and stories.', 'Plural: journeys', ['trip', 'path', 'adventure']],
  ['Kind', '/kaɪnd/', 'adjective', 'Friendly, caring, and helpful.', 'Kind classmates make practice easier.', 'Describing people and actions.', 'Noun: kindness', ['nice', 'gentle', 'caring']],
  ['Listen', '/ˈlɪsən/', 'verb', 'To pay attention to sounds or speech.', 'Listen carefully before you reply.', 'Conversation skills (essential).', 'Present: listen · Past: listened', ['hear', 'attend', 'heed']],
  ['Memorable', '/ˈmemərəbəl/', 'adjective', 'Easy to remember for a long time.', 'Our first chat was memorable.', 'Stories and travel.', 'Verb base: remember', ['unforgettable', 'notable', 'striking']],
  ['Negotiate', '/nɪˈɡəʊʃieɪt/', 'verb', 'To discuss terms to reach agreement.', 'They negotiated a fair price.', 'Business and conflict resolution.', 'Present: negotiate · Past: negotiated', ['bargain', 'discuss', 'arrange']],
  ['Observe', '/əbˈzɜːv/', 'verb', 'To watch carefully to learn.', 'Observe how native speakers link words.', 'Science, manners, and learning.', 'Present: observe · Past: observed', ['watch', 'notice', 'monitor']],
  ['Patient', '/ˈpeɪʃənt/', 'adjective', 'Able to wait calmly without anger.', 'Be patient with your mistakes.', 'Learning advice and personality.', 'Noun: patience', ['calm', 'tolerant', 'understanding']],
  ['Question', '/ˈkwestʃən/', 'noun', 'A sentence asked to get information.', 'Ask one clear question at a time.', 'Classroom and support chat.', 'Verb: question · Past: questioned', ['inquiry', 'query', 'doubt']],
  ['Reliable', '/rɪˈlaɪəbəl/', 'adjective', 'Able to be trusted to work well.', 'A reliable app helps daily study.', 'Products, people, and services.', 'Opposite: unreliable', ['dependable', 'trustworthy', 'solid']],
  ['Suggest', '/səˈdʒest/', 'verb', 'To propose an idea for others to consider.', 'I suggest practicing ten minutes daily.', 'Advice and planning.', 'Present: suggest · Past: suggested', ['recommend', 'propose', 'advise']],
  ['Talented', '/ˈtæləntɪd/', 'adjective', 'Having a natural ability.', 'She is a talented speaker.', 'Arts, sports, and praise.', 'Noun: talent', ['gifted', 'skilled', 'able']],
  ['Unique', '/juˈniːk/', 'adjective', 'One of a kind; not like others.', 'Every learner has a unique accent story.', 'Marketing and descriptions.', 'Adverb: uniquely', ['special', 'distinct', 'rare']],
  ['Valuable', '/ˈvæljuəbəl/', 'adjective', 'Worth a lot; very useful.', 'Feedback is valuable for improvement.', 'Business and learning.', 'Noun: value', ['precious', 'useful', 'important']],
  ['Wonder', '/ˈwʌndə/', 'verb', 'To think curiously or feel surprise.', 'I wonder how this word is used.', 'Questions and reflection.', 'Present: wonder · Past: wondered', ['question', 'ponder', 'marvel']],
  ['Xenial', '/ˈziːniəl/', 'adjective', 'Friendly and hospitable to guests.', 'A xenial host makes learners comfortable.', 'Culture and advanced vocabulary.', 'Related: hospitality', ['hospitable', 'welcoming', 'cordial']],
  ['Yearn', '/jɜːn/', 'verb', 'To want something strongly.', 'Many yearn to speak English fluently.', 'Poetic or formal speech.', 'Present: yearn · Past: yearned', ['long', 'desire', 'crave']],
  ['Zealous', '/ˈzeləs/', 'adjective', 'Showing great energy and enthusiasm.', 'Zealous students practice every day.', 'Formal writing and speeches.', 'Noun: zeal', ['enthusiastic', 'passionate', 'eager']],
  ['Abandon', '/əˈbændən/', 'verb', 'To leave something completely.', 'Do not abandon your study routine.', 'Stories and warnings.', 'Present: abandon · Past: abandoned', ['leave', 'quit', 'desert']],
  ['Brilliant', '/ˈbrɪliənt/', 'adjective', 'Extremely clever or impressive.', 'That was a brilliant answer.', 'Compliments and reviews.', 'Adverb: brilliantly', ['bright', 'excellent', 'genius']],
  ['Clarify', '/ˈklærɪfaɪ/', 'verb', 'To make something easier to understand.', 'Could you clarify this word?', 'Meetings and classroom.', 'Present: clarify · Past: clarified', ['explain', 'clear up', 'simplify']],
  ['Delicate', '/ˈdelɪkət/', 'adjective', 'Easily damaged; needing careful handling.', 'Pronunciation is a delicate skill.', 'Art, health, and manners.', 'Adverb: delicately', ['fragile', 'subtle', 'sensitive']],
  ['Eager', '/ˈiːɡə/', 'adjective', 'Wanting to do something very much.', 'Learners are eager to try random chat.', 'Motivation and introductions.', 'Noun: eagerness', ['excited', 'keen', 'enthusiastic']],
  ['Faithful', '/ˈfeɪθfəl/', 'adjective', 'Loyal and steady over time.', 'Stay faithful to daily word practice.', 'Relationships and habits.', 'Noun: faithfulness', ['loyal', 'devoted', 'constant']],
  ['Genuine', '/ˈdʒenjuɪn/', 'adjective', 'Real and sincere, not fake.', 'She gave genuine feedback.', 'Trust and friendship.', 'Adverb: genuinely', ['authentic', 'real', 'honest']],
  ['Hesitate', '/ˈhezɪteɪt/', 'verb', 'To pause before doing or saying something.', 'Do not hesitate to ask questions.', 'Speaking confidence tips.', 'Present: hesitate · Past: hesitated', ['pause', 'delay', 'waver']],
  ['Inspire', '/ɪnˈspaɪə/', 'verb', 'To fill someone with motivation.', 'Great mentors inspire learners.', 'Speeches and social posts.', 'Present: inspire · Past: inspired', ['motivate', 'encourage', 'uplift']],
  ['Justify', '/ˈdʒʌstɪfaɪ/', 'verb', 'To give a good reason for something.', 'Can you justify your answer?', 'Debates and writing.', 'Present: justify · Past: justified', ['explain', 'defend', 'support']],
  ['Keen', '/kiːn/', 'adjective', 'Very interested or eager.', 'He is keen to join group discussion.', 'British English (very common).', 'Adverb: keenly', ['eager', 'enthusiastic', 'sharp']],
  ['Loyal', '/ˈlɔɪəl/', 'adjective', 'Strongly supporting someone or something.', 'Loyal friends practice together.', 'Friendship and brands.', 'Noun: loyalty', ['faithful', 'devoted', 'steadfast']],
  ['Modest', '/ˈmɒdɪst/', 'adjective', 'Not boasting; humble about ability.', 'She is modest about her English level.', 'Personality and culture.', 'Noun: modesty', ['humble', 'unassuming']],
  ['Nurture', '/ˈnɜːtʃə/', 'verb', 'To help something develop and grow.', 'Nurture your vocabulary every day.', 'Parenting, coaching, and growth.', 'Present: nurture · Past: nurtured', ['foster', 'support', 'cultivate']],
  ['Optimistic', '/ˌɒptɪˈmɪstɪk/', 'adjective', 'Expecting good results in the future.', 'Stay optimistic about your progress.', 'Motivation and mindset.', 'Opposite: pessimistic', ['hopeful', 'positive', 'confident']],
  ['Persist', '/pəˈsɪst/', 'verb', 'To continue despite difficulty.', 'Persist for 100 days of words.', 'Goals and discipline.', 'Present: persist · Past: persisted', ['continue', 'persevere', 'keep going']],
  ['Qualify', '/ˈkwɒlɪfaɪ/', 'verb', 'To meet conditions needed for something.', 'She qualified for the advanced class.', 'Jobs, sports, and exams.', 'Present: qualify · Past: qualified', ['certify', 'pass']],
  ['Remarkable', '/rɪˈmɑːkəbəl/', 'adjective', 'Unusual and impressive.', 'Your improvement is remarkable.', 'Praise and news.', 'Adverb: remarkably', ['extraordinary', 'notable', 'striking']],
  ['Strive', '/straɪv/', 'verb', 'To try very hard to achieve something.', 'Strive for clear communication.', 'Formal goals and essays.', 'Present: strive · Past: strove / strived', ['try', 'aim', 'endeavor']],
  ['Thorough', '/ˈθʌrə/', 'adjective', 'Complete with attention to every detail.', 'Do a thorough review of tenses.', 'Work, study, and checks.', 'Adverb: thoroughly', ['complete', 'detailed', 'full']],
  ['Urgent', '/ˈɜːdʒənt/', 'adjective', 'Needing immediate action.', 'This deadline is urgent.', 'Emails and workplace.', 'Noun: urgency', ['pressing', 'critical', 'immediate']],
  ['Vivid', '/ˈvɪvɪd/', 'adjective', 'Producing clear, powerful images in the mind.', 'Use vivid examples in conversation.', 'Writing and storytelling.', 'Adverb: vividly', ['clear', 'bright', 'graphic']],
  ['Withdraw', '/wɪðˈdrɔː/', 'verb', 'To remove or take back.', 'Do not withdraw from speaking practice.', 'Formal and banking contexts.', 'Present: withdraw · Past: withdrew', ['remove', 'retreat', 'pull back']],
  ['Yield', '/jiːld/', 'verb', 'To produce or give way.', 'Daily study yields strong results.', 'Formal writing and traffic signs.', 'Present: yield · Past: yielded', ['produce', 'generate', 'surrender']],
  ['Ambition', '/æmˈbɪʃən/', 'noun', 'A strong desire to achieve success.', 'Her ambition is to study abroad.', 'Career talks and introductions.', 'Plural: ambitions', ['goal', 'drive', 'aspiration']],
  ['Bargain', '/ˈbɑːɡɪn/', 'noun / verb', 'Something bought at a good price; to negotiate.', 'That course is a real bargain.', 'Shopping and markets.', 'Past: bargained', ['deal', 'discount', 'negotiate']],
  ['Compromise', '/ˈkɒmprəmaɪz/', 'noun / verb', 'An agreement where each side gives up something.', 'They reached a compromise.', 'Teamwork and politics.', 'Past: compromised', ['settlement', 'deal', 'middle ground']],
  ['Dedicate', '/ˈdedɪkeɪt/', 'verb', 'To give time and effort to something important.', 'Dedicate fifteen minutes to listening.', 'Goals and habits.', 'Past: dedicated', ['commit', 'devote', 'assign']],
  ['Embrace', '/ɪmˈbreɪs/', 'verb', 'To accept willingly and enthusiastically.', 'Embrace mistakes as part of learning.', 'Motivation and change.', 'Past: embraced', ['accept', 'welcome', 'adopt']],
  ['Fragile', '/ˈfrædʒaɪl/', 'adjective', 'Easy to break or damage.', 'Confidence can feel fragile at first.', 'Objects and emotions.', 'Adverb: fragile (rare)', ['delicate', 'weak', 'brittle']],
  ['Gradual', '/ˈɡrædʒuəl/', 'adjective', 'Happening slowly over time.', 'Gradual progress is still progress.', 'Change and improvement.', 'Adverb: gradually', ['slow', 'steady', 'progressive']],
  ['Harmony', '/ˈhɑːməni/', 'noun', 'A pleasing combination or peaceful balance.', 'Group chat works best in harmony.', 'Music, teams, and relationships.', 'Adjective: harmonious', ['balance', 'unity', 'accord']],
  ['Illuminate', '/ɪˈluːmɪneɪt/', 'verb', 'To light up or make clear.', 'This example illuminates the meaning.', 'Formal and academic tone.', 'Past: illuminated', ['clarify', 'explain', 'light up']],
  ['Jeopardy', '/ˈdʒepədi/', 'noun', 'Risk of harm or failure.', 'Skipping practice puts goals in jeopardy.', 'News and formal speech.', 'Phrase: in jeopardy', ['danger', 'risk', 'threat']],
  ['Keenly', '/ˈkiːnli/', 'adverb', 'In an eager or intense way.', 'She keenly listens to native speakers.', 'Advanced descriptions.', 'From adjective: keen', ['eagerly', 'intensely', 'sharply']],
  ['Luminous', '/ˈluːmɪnəs/', 'adjective', 'Giving off light; bright and clear.', 'Her explanation was luminous and simple.', 'Poetic descriptions.', 'Noun: luminosity', ['bright', 'radiant', 'glowing']],
  ['Magnitude', '/ˈmæɡnɪtjuːd/', 'noun', 'The great size or importance of something.', 'Understand the magnitude of daily practice.', 'Science and formal writing.', 'Related: magnificent', ['scale', 'size', 'importance']],
  ['Notable', '/ˈnəʊtəbəl/', 'adjective', 'Important and worth noticing.', 'A notable change in her accent.', 'News and reports.', 'Adverb: notably', ['remarkable', 'significant', 'noteworthy']],
  ['Outspoken', '/aʊtˈspəʊkən/', 'adjective', 'Expressing opinions openly and boldly.', 'Outspoken learners ask more questions.', 'Personality and politics.', 'From phrasal verb: speak out', ['bold', 'frank', 'direct']],
  ['Profound', '/prəˈfaʊnd/', 'adjective', 'Very deep or intense.', 'Language opens profound opportunities.', 'Philosophy and formal essays.', 'Adverb: profoundly', ['deep', 'intense', 'great']],
  ['Quaint', '/kweɪnt/', 'adjective', 'Attractively old-fashioned or charming.', 'We met in a quaint café to practice.', 'Travel and storytelling.', 'Adverb: quaintly', ['charming', 'picturesque', 'old-fashioned']],
  ['Resilient', '/rɪˈzɪliənt/', 'adjective', 'Able to recover quickly from difficulty.', 'Resilient learners keep going.', 'Psychology and coaching.', 'Noun: resilience', ['tough', 'strong', 'flexible']],
  ['Subtle', '/ˈsʌtəl/', 'adjective', 'Not obvious; delicate and hard to notice.', 'Notice subtle differences in tone.', 'Art, humor, and advanced English.', 'Adverb: subtly', ['slight', 'faint', 'nuanced']],
  ['Tangible', '/ˈtændʒəbəl/', 'adjective', 'Clear and real enough to touch or measure.', 'Set tangible weekly goals.', 'Business and planning.', 'Opposite: intangible', ['real', 'concrete', 'measurable']],
  ['Unite', '/juˈnaɪt/', 'verb', 'To join together for a common purpose.', 'Apps unite learners across regions.', 'Teams, countries, and causes.', 'Past: united', ['join', 'combine', 'merge']],
  ['Versatile', '/ˈvɜːsətaɪl/', 'adjective', 'Able to do many things well.', 'English is a versatile global tool.', 'Skills and tools.', 'Noun: versatility', ['flexible', 'adaptable', 'all-round']],
  ['Widespread', '/ˈwaɪdspred/', 'adjective', 'Found in many places or among many people.', 'English is widespread worldwide.', 'News and reports.', 'From: wide + spread', ['common', 'extensive', 'prevalent']],
  ['Yearly', '/ˈjɪəli/', 'adjective / adverb', 'Happening every year.', 'A yearly review tracks your level.', 'Plans and finance.', 'Noun: year', ['annual', 'once a year']],
  ['Zeal', '/ziːl/', 'noun', 'Great enthusiasm for a cause.', 'She studies with zeal.', 'Formal and literary use.', 'Adjective: zealous', ['passion', 'enthusiasm', 'devotion']],
  ['Articulate', '/ɑːˈtɪkjuleɪt/', 'verb / adjective', 'To express ideas clearly; well-spoken.', 'He articulates his thoughts well.', 'Presentations and interviews.', 'Past: articulated', ['express', 'communicate', 'eloquent']],
  ['Benchmark', '/ˈbentʃmɑːk/', 'noun', 'A standard used for comparison.', 'Use day one as your benchmark.', 'Business and testing.', 'Verb: benchmark', ['standard', 'reference', 'measure']],
  ['Candid', '/ˈkændɪd/', 'adjective', 'Honest and direct, even if uncomfortable.', 'Give candid feedback kindly.', 'Reviews and coaching.', 'Adverb: candidly', ['frank', 'open', 'blunt']],
  ['Diligent', '/ˈdɪlɪdʒənt/', 'adjective', 'Careful and hardworking.', 'Diligent learners finish 100 days.', 'School and workplace.', 'Noun: diligence', ['hardworking', 'careful', 'thorough']],
  ['Empathy', '/ˈempəθi/', 'noun', 'Understanding another person’s feelings.', 'Empathy improves conversation.', 'Relationships and support.', 'Adjective: empathetic', ['understanding', 'compassion', 'sympathy']],
  ['Frugal', '/ˈfruːɡəl/', 'adjective', 'Careful with money; not wasteful.', 'Frugal students use free tools.', 'Money and lifestyle.', 'Adverb: frugally', ['thrifty', 'economical', 'saving']],
  ['Gregarious', '/ɡrɪˈɡeəriəs/', 'adjective', 'Sociable; enjoying company.', 'Gregarious learners love group chat.', 'Personality descriptions.', 'Noun: gregariousness (rare)', ['sociable', 'outgoing', 'friendly']],
  ['Habit', '/ˈhæbɪt/', 'noun', 'A regular action done almost without thinking.', 'Build a daily word habit.', 'Self-improvement (key topic).', 'Adjective: habitual', ['routine', 'practice', 'custom']],
  ['Insight', '/ˈɪnsaɪt/', 'noun', 'A deep and clear understanding.', 'This word gives insight into formal English.', 'Analysis and learning.', 'Plural: insights', ['understanding', 'wisdom', 'perception']],
  ['Judicious', '/dʒuːˈdɪʃəs/', 'adjective', 'Showing good judgment.', 'Make judicious use of new vocabulary.', 'Formal advice.', 'Adverb: judiciously', ['wise', 'sensible', 'prudent']],
  ['Knack', '/næk/', 'noun', 'A natural skill for doing something.', 'She has a knack for idioms.', 'Informal compliments.', 'Plural: knacks', ['talent', 'skill', 'gift']],
  ['Lucid', '/ˈluːsɪd/', 'adjective', 'Clear and easy to understand.', 'Give a lucid explanation.', 'Writing and teaching.', 'Adverb: lucidly', ['clear', 'plain', 'coherent']],
  ['Meticulous', '/məˈtɪkjələs/', 'adjective', 'Very careful about every small detail.', 'Meticulous notes help review words.', 'Work quality.', 'Adverb: meticulously', ['careful', 'precise', 'thorough']],
  ['Nuance', '/ˈnjuːɑːns/', 'noun', 'A small difference in meaning or tone.', 'Learn the nuance between similar words.', 'Advanced English.', 'Adjective: nuanced', ['shade', 'subtlety', 'distinction']],
  ['Pragmatic', '/præɡˈmætɪk/', 'adjective', 'Focused on practical results.', 'Take a pragmatic approach to grammar.', 'Business and problem solving.', 'Adverb: pragmatically', ['practical', 'realistic', 'sensible']],
  ['Quell', '/kwel/', 'verb', 'To stop or calm something strong.', 'Deep breaths quell speaking anxiety.', 'Literary and formal.', 'Past: quelled', ['calm', 'suppress', 'ease']],
  ['Rhetoric', '/ˈretərɪk/', 'noun', 'The art of persuasive speaking.', 'Politicians use rhetoric skillfully.', 'Academic and media.', 'Adjective: rhetorical', ['oratory', 'persuasion', 'speechcraft']],
  ['Scrutiny', '/ˈskruːtɪni/', 'noun', 'Close and critical examination.', 'Your essay faced public scrutiny.', 'News and formal contexts.', 'Verb: scrutinize', ['examination', 'inspection', 'review']],
  ['Tenacious', '/təˈneɪʃəs/', 'adjective', 'Not giving up easily.', 'Tenacious practice wins fluency.', 'Motivation and sports.', 'Noun: tenacity', ['persistent', 'determined', 'stubborn']],
  ['Ubiquitous', '/juːˈbɪkwɪtəs/', 'adjective', 'Seeming to be everywhere.', 'Smartphones are ubiquitous.', 'Academic and tech writing.', 'Noun: ubiquity', ['everywhere', 'omnipresent', 'common']],
  ['Venerate', '/ˈvenəreɪt/', 'verb', 'To respect deeply, almost worship.', 'Some cultures venerate great teachers.', 'History and religion.', 'Past: venerated', ['honor', 'revere', 'respect']],
  ['Witty', '/ˈwɪti/', 'adjective', 'Clever and funny in speech.', 'A witty reply keeps chat lively.', 'Social conversation.', 'Noun: wit', ['clever', 'humorous', 'amusing']],
  ['Yearning', '/ˈjɜːnɪŋ/', 'noun', 'A strong longing for something.', 'A yearning to speak without fear.', 'Literary tone.', 'From verb: yearn', ['longing', 'desire', 'craving']],
  ['Zest', '/zest/', 'noun', 'Great enthusiasm and energy.', 'Study with zest each morning.', 'Informal motivation.', 'Adjective: zesty (for food)', ['enthusiasm', 'energy', 'gusto']],
];

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const entries = words.map((w, i) => {
  const [word, phonetic, pos, meaning, example, whereUsed, tenses, synonyms] = w;
  return `  {
    day: ${i + 1},
    word: '${esc(word)}',
    phonetic: '${esc(phonetic)}',
    partOfSpeech: '${esc(pos)}',
    meaning: '${esc(meaning)}',
    example: '${esc(example)}',
    whereUsed: '${esc(whereUsed)}',
    tenses: ${tenses ? `'${esc(tenses)}'` : 'null'},
    synonyms: [${synonyms.map((s) => `'${esc(s)}'`).join(', ')}],
  }`;
});

const out = `export type DailyWordEntry = {
  day: number;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  example: string;
  whereUsed: string;
  tenses: string | null;
  synonyms: string[];
};

export const DAILY_WORD_TOTAL_DAYS = 100;

export const DAILY_WORDS: DailyWordEntry[] = [
${entries.join(',\n')}
];

export function getDailyWordDayNumber(): number {
  const epochDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return (epochDay % DAILY_WORD_TOTAL_DAYS) + 1;
}

export function getDailyWordForToday(): DailyWordEntry {
  const index = getDailyWordDayNumber() - 1;
  return DAILY_WORDS[index];
}
`;

fs.writeFileSync(path.join(__dirname, '../constants/dailyWords.ts'), out);
console.log('Generated', words.length, 'daily words');
