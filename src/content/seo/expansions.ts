import { FACTS } from './facts'
import { callout, h2, h3, ol, p, table, ul, type Block } from './types'

const { free, starter } = FACTS

/**
 * Extra sections appended to existing pages. Examples are illustrations of how to write and plan,
 * clearly labeled as such. No statistics or results are claimed.
 */
export const expansions: Record<string, Block[]> = {
  'use-cases/bloggers': [
    h2('pin-ideas', 'Five pins from one post'),
    p('One post can support several pins that appeal to different searches. Take a post called "Easy weeknight pasta recipes" as an illustration:'),
    table(['Pin', 'Angle', 'Example title'], [
      ['1', 'The main keyword', 'Easy weeknight pasta recipes for busy families'],
      ['2', 'A list format', '10 quick pasta dinners ready in 30 minutes'],
      ['3', 'A single benefit', 'One-pot pasta recipes with almost no washing up'],
      ['4', 'A question', 'What to cook when you only have pasta and a jar of sauce?'],
      ['5', 'A seasonal angle', 'Cozy pasta bakes for cold evenings'],
    ], 'Illustrative example only.'),
    p('Each pin uses a different image and headline but links to the same post. Schedule them a few days apart rather than together.'),
    h2('weekly-routine', 'A weekly routine that takes under an hour'),
    ol(
      'Pick the posts you published or updated this week.',
      'Import each URL and choose the strongest images. Add pin graphics you made elsewhere through the Bulk schedule page.',
      'Edit titles so the main keyword comes first, then check the descriptions read naturally.',
      'Choose a board for each batch and a pace of two or three pins a day.',
      'Open the calendar to confirm the coming two weeks are covered, and check the Pins page for anything that failed.',
    ),
    h2('measure', 'Measure what works'),
    p('After a few weeks, open Analytics. Look at impressions, saves and outbound clicks, and note which topics and image styles earn clicks to your blog. Make more of those, and retire pins that attract views but no clicks by changing the image or title.'),
    h2('mistakes', 'Common blogger mistakes'),
    ul(
      'Pinning only new posts and ignoring the archive.',
      'Using the blog\'s landscape featured image instead of a vertical pin image.',
      'Linking pins to a category page rather than the specific post.',
      'Publishing every pin for one post on the same day.',
    ),
  ],

  'use-cases/etsy-sellers': [
    h2('copy', 'Writing titles and descriptions for listings'),
    table(['', 'Weak', 'Stronger'], [
      ['Title', 'Handmade ceramic mug', 'Handmade ceramic coffee mug in speckled blue glaze'],
      ['Description', 'Mug for sale in my shop.', 'A hand-thrown 12 oz mug with a speckled blue glaze. A gift idea for coffee lovers. Find the full range in the shop link.'],
    ], 'Illustrative example only. Use your own product details.'),
    p('Name the product, its material or style and who it is for. Mention a use or occasion, since shoppers on Pinterest are often looking for ideas rather than a specific item.'),
    h2('image-types', 'Image types to rotate'),
    ul(
      '**Lifestyle:** the product in use, in a room or on a person.',
      '**Detail:** a close-up of texture, finish or packaging.',
      '**Collection:** several items together, linking to the shop section.',
      '**Gift guide:** a themed set for a season or recipient.',
    ),
    h2('workflow', 'A realistic workflow'),
    ol(
      'Make a spreadsheet with one row per pin: the image link, a title, a description and the listing URL.',
      'Save it as CSV and import it on the Bulk schedule page.',
      'Review each pin and choose a board that matches the collection.',
      'Schedule the batch at two or three pins a day so listings keep appearing.',
      'Remove the pins for any listing that sells out or is deactivated.',
    ),
    callout('Pinterest and Etsy have their own rules about product content and links. You are responsible for following both.', 'Rules'),
  ],

  'use-cases/shopify-stores': [
    h2('collection-strategy', 'Organize boards the way shoppers search'),
    p('Shoppers search for ideas ("small balcony furniture") rather than for your category names. Create boards around those searches and route products onto them, instead of mirroring your store menu. The Boards page lets you see what you have and create new boards, and the assistant can suggest which board fits a pin.'),
    h2('example-plan', 'An example month for a 40-product store'),
    table(['Week', 'Focus', 'Pace'], [
      ['1', 'Best sellers, lifestyle images', '2 pins a day'],
      ['2', 'A seasonal collection', '3 pins a day'],
      ['3', 'New arrivals, one pin per new product', '2 pins a day'],
      ['4', 'Gift guides linking to several products', '2 pins a day'],
    ], 'Illustrative planning example, not a result. Adjust to your catalog and capacity.'),
    p(`At two to three pins a day this is roughly 60 to 90 pins a month, which fits within the Starter plan (${starter.pins} pins a month).`),
    h2('quality', 'Quality checks before you schedule'),
    ul(
      'Every pin links to a live product or collection page.',
      'Titles describe the product and its use, not just the SKU name.',
      'No two pins in the same week use the same image.',
      'Prices and availability are not stated in the pin text, since they change.',
    ),
  ],

  'guides/pinterest-native-scheduler-limits': [
    h2('migrate', 'Moving from the built-in scheduler to a tool'),
    ol(
      'List the pins you have scheduled in Pinterest and note their dates.',
      'Create the same pins in the scheduler tool, using the original images.',
      'Delete the matching scheduled pins in Pinterest so they do not publish twice.',
      'Check the calendar in the tool to confirm the next two weeks are covered.',
    ),
    callout('Do the deletion step carefully. Publishing the same pin twice looks repetitive and wastes a slot.', 'Avoid duplicates'),
    h2('decision', 'A quick decision guide'),
    table(['Your situation', 'Best choice'], [
      ['Under 10 pins queued, planning within a month', "Pinterest's built-in scheduler"],
      ['Want to plan seasonal content months ahead', 'A scheduler tool with a longer horizon'],
      ['Creating pins for many pages or products', 'Bulk scheduling and website import'],
      ['Need to edit scheduled pins often', 'A scheduler that lets you edit pins in the queue'],
    ]),
    p(`GoPinKaro's free plan includes ${free.pins} pins a month and lets you edit, move or delete any pin until it publishes.`),
  ],

  'guides/pinterest-image-size-and-specs': [
    h2('checklist', 'Pre-export checklist'),
    ol(
      'The image is vertical, 1000 x 1500 pixels or the same 2:3 ratio.',
      'Text is large enough to read on a phone and sits away from the edges.',
      'The file is JPG, PNG or WEBP and well under the size limit.',
      'The title sits near the top and the main subject is clear at a small size.',
      'You have a destination link and a one-sentence alt text ready.',
    ),
    h2('design-tips', 'Design tips that hold up in the feed'),
    ul(
      '**One idea per pin.** A clear headline and one image beat a crowded collage.',
      '**High contrast text.** Test it at thumbnail size.',
      '**Consistent branding.** A small logo or color palette helps pins look like yours without dominating them.',
      '**Variety across a page.** Make several different pins for the same page.',
    ),
    h2('batch', 'Exporting in batches'),
    p('If you design many pins at once, export them in one batch with consistent names such as kitchen-storage-1.jpg. Upload the folder to the Bulk schedule page and GoPinKaro turns each file name into a first-draft title that you can edit.'),
  ],

  'guides/how-often-to-pin-on-pinterest': [
    h2('math', 'Turning a pace into a monthly number'),
    table(['Pins per day', 'About pins per month', 'Plan that covers it'], [
      ['1', '30', `Free (${free.pins} a month)`],
      ['2', '60', `Starter (${starter.pins} a month)`],
      ['3', '90', `Starter (${starter.pins} a month)`],
      ['5', '150', `Starter (${starter.pins} a month)`],
      ['10', '300', 'Starter, at its limit, or Pro for more headroom'],
    ], 'Pins count against your monthly allowance in the month they are scheduled to publish.'),
    h2('content-supply', 'Match the pace to your content supply'),
    p('The right pace is the highest one for which you still have good, varied pins. If you only have ten decent images, pinning five a day uses them up in two days and then repeats. A smaller steady pace for longer is better than a burst that ends.'),
    h2('seasonal', 'Seasonal planning'),
    p('Pins for seasonal topics need to be published ahead of the season, because people start searching earlier than you might expect. Pinterest\'s own scheduler cannot go beyond about 30 days; GoPinKaro lets you schedule up to a year ahead, so a seasonal batch can be prepared early and left to run.'),
  ],

  'guides/pinterest-seo-basics': [
    h2('example', 'A worked example'),
    table(['', 'Before', 'After'], [
      ['Title', 'Our new recipe', 'Easy one-pot chicken and rice dinner'],
      ['Description', 'Check this out! #food', 'A simple one-pot chicken and rice dinner that takes 40 minutes and needs one pan. Save it for a busy weeknight. #weeknightdinner #onepotmeals'],
      ['Alt text', 'Food', 'A pot of chicken and rice with chopped parsley on a wooden table'],
      ['Board', 'Food', 'Easy weeknight dinners'],
    ], 'Illustrative example only.'),
    p('The "after" version says what the pin is, who it is for and why they would save it, using words a person would actually search.'),
    h2('checklist', 'A quick pre-publish checklist'),
    ol(
      'Does the title lead with the main keyword?',
      'Does the description read like a sentence, with the keyword once or twice?',
      'Is there alt text that describes the image?',
      'Is the pin on a focused board with a clear name?',
      'Does the destination page deliver what the pin promises?',
    ),
    h2('tools', 'Tools that help'),
    p('GoPinKaro\'s AI writer drafts three title and description options for a topic, and the keyword tool shows what is trending. Treat both as drafts: read, edit and keep the wording natural.'),
  ],

  'free-pinterest-scheduler': [
    h2('free-workflow', 'A realistic free workflow'),
    ol(
      `Use GoPinKaro Free for up to ${free.pins} pins a month, adding up to ${FACTS.freeBatchMax} pins per request.`,
      'Use the website importer for your most important pages, within your monthly imports.',
      'Use Pinterest Trends to choose topics, and Canva Free to design the images.',
      'Review analytics after a month before deciding whether you need more volume.',
    ),
    h2('limits-honest', 'What you give up on the free plan'),
    ul(
      'Best-time slots and auto spacing at a pins-per-day pace. You pick a fixed interval instead.',
      'Bulk and CSV scheduling beyond ten pins per request.',
      'Sitemap import.',
      'Analytics history beyond seven days.',
    ),
  ],

  'pinterest-keyword-tool': [
    h2('workflow', 'A five-minute keyword workflow'),
    ol(
      'Open Keywords, choose your region and type a word from your niche.',
      'Note two or three rising phrases that genuinely match something you publish.',
      'Open the AI writer and give it the phrase as the topic.',
      'Pick the best of three options, edit it, and attach it to a pin.',
      'Use the same phrase in a board name if you do not already have a board for it.',
    ),
    h2('limits', 'Limits to be aware of'),
    ul(
      'Trend data describes growth, so a fast-growing phrase can still be small.',
      'Not every phrase suits your content. Choose ones you can actually answer well.',
      'Trends differ by region. A rising phrase in the United States may not matter in another country.',
    ),
  ],

  'pinterest-bulk-scheduler': [
    h2('workflow', 'A bulk workflow, start to finish'),
    ol(
      'Design or collect your images and name them clearly.',
      'Drop them into Bulk schedule, or import a CSV with titles, descriptions and links.',
      'Fix titles in the editor and remove any pin you are not happy with.',
      'Choose a board and a pace, check the date of the last pin, and schedule.',
      'Watch the Pins page and calendar as pins publish.',
    ),
    h2('example', 'Example: 60 pins over a month'),
    p('Sixty pins at two a day with best-time slots take about thirty days. Starting from the next free slot after your last scheduled pin, GoPinKaro places them in the afternoon and evening in your timezone. If you choose a fixed interval of twelve hours instead, the same sixty pins also take thirty days.'),
    callout(`A paid plan is needed to schedule more than ${FACTS.freeBatchMax} pins at a time, and your monthly pin limit applies either way.`),
  ],

  'pinterest-automation-tool': [
    h2('example-flow', 'Example: automate one blog post'),
    ol(
      'Paste the post URL into the assistant and ask: "Turn this into 4 pins and schedule them at 2 a day on my Recipes board."',
      'The assistant reads the page, drafts titles and descriptions, and shows a confirmation card with the dates and titles.',
      'You check the card and press Confirm.',
      'The pins publish over two days. If one fails, you see the reason and can retry it.',
    ),
    p('The same flow works from the Website to pins page if you would rather click through than chat.'),
  ],

  'website-to-pinterest-pins': [
    h2('page-types', 'Which pages work best'),
    table(['Page type', 'Works well when', 'Watch out for'], [
      ['Blog posts', 'The post has several clear images', 'Landscape images may need a vertical version'],
      ['Product pages', 'Product photos are high quality', 'Repeating the same product image'],
      ['Category and collection pages', 'You want a themed pin', 'Many small thumbnails'],
      ['Landing pages', 'There is a single strong hero image', 'Very little text for the AI to work from'],
    ]),
    h2('after-import', 'After the import'),
    p('Treat the drafted copy as a first pass. Read each title aloud: if it sounds like something a person would search or click, keep it. If it sounds like a headline written for a different website, rewrite it.'),
  ],
}
void h3
