import {HistoryList} from "@/components/history-list";
export const metadata={title:"Private history · JevArena",robots:{index:false,follow:false}};
export default function History(){return <main id="main" className="prose-page"><h1>Your private history</h1><HistoryList/></main>;}
