import { PLANS } from '@shared/plans'

export interface HelpTopic { id: string; title: string; summary: string; steps: string[]; href?: { label: string; to: string } }

const F = PLANS.free_trial

/** In-app help. Every statement is about something the product does today. */
export const FIRST_PIN: string[] = [
  'Connect Pinterest: open Accounts and choose Connect. You sign in on Pinterest itself; GoPinKaro never sees your password.',
  'Make a pin: open Pin designer, pick a template, add your title and an image (upload one, or use an AI background on paid plans), and choose a board.',
  'Pick a time: choose a date and time, or on a paid plan let GoPinKaro choose the next best-time slot.',
  'Schedule it. The pin appears on your Calendar as scheduled and moves to published once Pinterest accepts it.',
]

export const TOPICS: HelpTopic[] = [
  { id: 'schedule', title: 'Schedule one pin', summary: 'Upload an image, write a title and description, choose a board and a time.',
    steps: ['Open New pin.', 'Add an image (vertical, 2:3, such as 1000 x 1500 pixels, works best).', 'Write a title with the main keyword first, and a description in natural sentences.', 'Choose a board, then a date and time, and select Schedule.', 'GoPinKaro warns you if the image is already scheduled nearby or if one day is crowded.'], href: { label: 'New pin', to: '/dashboard/schedule' } },
  { id: 'bulk', title: 'Schedule many pins at once', summary: 'Bulk upload images or import a CSV, then spread them over days.',
    steps: [`Free plans schedule up to 10 pins at a time. Paid plans schedule up to 200 at a time.`, 'Open Bulk schedule and drop in your images, or import a CSV.', 'Choose a board and how many pins a day. On paid plans the best times are picked for you.', 'Review the list, fix any titles, and schedule.'], href: { label: 'Bulk schedule', to: '/dashboard/bulk' } },
  { id: 'import', title: 'Turn a web page into pins', summary: 'Paste a page address and GoPinKaro drafts titles, descriptions and finds images.',
    steps: ['Open From website and paste a public page address.', 'Choose the images you want. Each becomes a draft pin.', 'Edit the titles and descriptions, choose a board, and schedule.', `Imports are counted each month: ${F.website_imports} on Free, more on paid plans. Sitemap import is on Pro and above.`], href: { label: 'From website', to: '/dashboard/import' } },
  { id: 'autopilot', title: 'Autopilot for your blog', summary: 'Connect a website, feed or sitemap. New posts become drafts you approve.',
    steps: ['Open Autopilot and paste your website address. GoPinKaro finds its RSS feed (WordPress has one at /feed). A sitemap address works too.', 'Pick a default board if you like.', 'About every 30 minutes new posts appear under Drafts to review.', 'Edit the title and description, choose the board, and Approve. Nothing is published without your approval.', 'A feed that fails 10 times in a row is paused and you are notified.'], href: { label: 'Autopilot', to: '/dashboard/autopilot' } },
  { id: 'accounts', title: 'More than one Pinterest account', summary: 'Switch accounts from the sidebar. Each has its own boards, queue and analytics.',
    steps: [`Your plan sets how many accounts you can connect: ${F.accounts} on Free, ${PLANS.starter.accounts} on Starter, ${PLANS.pro.accounts} on Pro, ${PLANS.growth.accounts} on Business.`, 'Sign in to the other account on Pinterest first, then choose Add account.', 'The monthly pin allowance is shared across all accounts.'], href: { label: 'Accounts', to: '/dashboard/accounts' } },
  { id: 'analytics', title: 'Read your analytics', summary: 'Impressions, saves and clicks come from Pinterest; engagement rate is calculated.',
    steps: ['Pinterest reports numbers one to two days late.', 'Refresh pulls the latest from Pinterest (once every 10 minutes per account).', 'Best boards, destination pages and posting hours use only pins published through GoPinKaro and show association, not proof of cause.', 'Download Daily CSV or Pins CSV to use the numbers elsewhere.'], href: { label: 'Analytics', to: '/dashboard/analytics' } },
  { id: 'limits', title: 'Usage limits', summary: 'Pins, AI writing, AI images and page imports reset on the first of each month (UTC).',
    steps: ['The Overview page shows how much of each allowance you have used.', 'The pin allowance counts pins scheduled for that month.', 'When you reach a limit you see a message and an upgrade link; nothing is charged automatically.'], href: { label: 'Plans', to: '/dashboard/upgrade' } },
]

export const TROUBLESHOOTING: { q: string; a: string }[] = [
  { q: 'A pin shows Failed. What now?', a: 'Open the pin to see the reason. Common causes are an expired Pinterest connection (reconnect on the Accounts page), a deleted board, or an image Pinterest rejected. Fix it, then reschedule. GoPinKaro retries temporary Pinterest errors automatically before marking a pin failed.' },
  { q: 'It says my Pinterest account needs to be reconnected.', a: 'Pinterest access expired or was revoked. Open Accounts, choose Reconnect and sign in to Pinterest again. Scheduled pins resume afterwards.' },
  { q: 'I reached my monthly pin limit.', a: 'The limit counts pins scheduled for that month. Move pins to next month, delete ones you no longer need, or upgrade your plan.' },
  { q: 'Why did an import fail?', a: 'The page must be public. Pages behind a login, private addresses and local network addresses are blocked. A failed import is not counted against your monthly imports.' },
  { q: 'Autopilot found no drafts.', a: 'Drafts appear only for posts published after you connected (a new feed drafts its 3 newest posts, a sitemap only pages added later). Posts already scheduled on this account are skipped as duplicates.' },
]
