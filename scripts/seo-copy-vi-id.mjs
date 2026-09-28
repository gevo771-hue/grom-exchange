/**
 * Stage 3 SEO copy: Vietnamese (vi) + Indonesian (id).
 * Merged into seo-copy-localized.mjs exports.
 */
import { SEO_LOCALES, localePath } from './seo-locales.mjs';

function p(localeCode, productPath) {
  const loc = SEO_LOCALES.find((l) => l.code === localeCode) || SEO_LOCALES[0];
  return localePath(loc, productPath);
}

export const SEO_META_VI_ID = {
  vi: {
    landing: {
      title: 'GROM Exchange — Terminal DeFi không lưu ký',
      description: 'Swap, perpetual futures, prediction markets và Tokenized Stocks từ ví của bạn. Không gửi ký quỹ custodial trên GROM.',
    },
    dashboard: {
      title: 'Swap crypto cross-chain từ ví của bạn',
      description: 'Đổi token giữa nhiều mạng, ký trong wallet. Nhiều router báo giá; settlement on-chain về địa chỉ của bạn.',
    },
    futures: {
      title: 'Spot và Perpetual Futures từ ví của bạn',
      description: 'Giao dịch spot và perpetual bằng chữ ký từ ví tự lưu ký. Margin nằm ở venue — GROM không giữ số dư.',
    },
    predict: {
      title: 'Prediction Markets từ ví của bạn',
      description: 'Mở vị thế sự kiện bằng số dư ví đã kết nối. Thanh toán theo quy tắc thị trường; GROM không trả tùy ý.',
    },
    xstocks: {
      title: 'Tokenized Stocks (RWA) on-chain 24/7 — GROM Stocks',
      description: 'Phơi nhiễm cổ phiếu token hóa từ ví của bạn, thường ngoài giờ sàn truyền thống. Không phải tài khoản môi giới.',
    },
    markets: {
      title: 'Markets và giá trực tiếp — GROM Exchange',
      description: 'Khám phá giá rồi mở Swap, Trade, Predictions hoặc Stocks. Markets không lưu trữ tiền.',
    },
  },
  id: {
    landing: {
      title: 'GROM Exchange — Terminal DeFi non-kustodial',
      description: 'Swap, perpetual futures, prediction markets, dan Tokenized Stocks dari wallet Anda. Tanpa deposit kustodial di GROM.',
    },
    dashboard: {
      title: 'Swap kripto lintas chain dari wallet Anda',
      description: 'Tukar token antar jaringan; tanda tangani di wallet. Beberapa router memberi kuotasi; settlement on-chain ke alamat Anda.',
    },
    futures: {
      title: 'Spot dan Perpetual Futures dari wallet Anda',
      description: 'Perdagangkan spot dan perpetual dengan tanda tangan dari wallet self-custody. Margin di venue — GROM tidak menyimpan saldo.',
    },
    predict: {
      title: 'Prediction Markets dari wallet Anda',
      description: 'Ambil posisi pada peristiwa dengan saldo wallet yang terhubung. Resolusi mengikuti aturan pasar; GROM tidak membayar sewenang-wenang.',
    },
    xstocks: {
      title: 'Aksi tokenisasi (RWA) on-chain 24/7 — GROM Stocks',
      description: 'Eksposur saham yang ditokenisasi dari wallet Anda, sering di luar jam bursa tradisional. Bukan rekening broker.',
    },
    markets: {
      title: 'Markets dan harga live — GROM Exchange',
      description: 'Jelajahi harga lalu buka Swap, Trade, Predictions, atau Stocks. Markets tidak menyimpan dana.',
    },
  },
};

export const SEO_COPY_VI = {
  landing: {
    h1: 'GROM Exchange — terminal DeFi không lưu ký',
    lead: 'GROM là hub crypto ưu tiên ví. Bạn kết nối ví self-custody, giữ khóa riêng và tự ký mọi thao tác. Không có tài khoản gửi ký trên sàn và không có KYC GROM cho giao dịch cơ bản từ ví.',
    appName: 'GROM Exchange',
    appDesc: 'Terminal DeFi không lưu ký cho swap cross-chain, spot và perpetual futures, prediction markets và tokenized stocks.',
    sections: [
      {
        h2: 'Bốn dòng sản phẩm, một ví',
        html: `<p>GROM gom bốn thị trường trong một giao diện: <a href="${p('vi', '/swap')}">Swap cross-chain và định tuyến kiểu spot</a>, <a href="${p('vi', '/futures')}">perpetual futures và spot</a>, <a href="${p('vi', '/predict')}">prediction markets</a> và <a href="${p('vi', '/stocks')}">Tokenized Stocks (RWA)</a>. Giá và khám phá nằm ở <a href="${p('vi', '/markets')}">Markets</a>.</p>
<p>Mỗi sản phẩm thanh toán về địa chỉ bạn kiểm soát. Báo giá và khớp lệnh đến từ venue và aggregator on-chain; GROM không giữ số dư của bạn.</p>`,
      },
      {
        h2: 'Giao dịch diễn ra thế nào',
        html: `<p>Kết nối ví Web3 (tiện ích mở rộng hoặc WalletConnect). Chọn sản phẩm, kiểm tra báo giá hoặc ticket rồi xác nhận chữ ký hoặc giao dịch trong wallet. Tài sản chuyển trên mạng hoặc venue đích — không vào số dư GROM rồi mới rút.</p>
<p>Swap hỗ trợ các mạng EVM chính và hệ sinh thái khác mà lớp routing hiển thị. Futures, predictions và Tokenized Stocks dùng mạng mà từng sản phẩm yêu cầu. Trước khi ký, luôn đối chiếu mạng và tài sản trong lời nhắc ví.</p>`,
      },
      {
        h2: 'Phí và rủi ro',
        html: `<p>Swap hiện routing fee trong báo giá cộng gas mạng. Perpetuals, Predictions và Tokenized Stocks thu phí venue được tiết lộ trên ticket trước khi xác nhận. GROM không hứa lợi suất, khối lượng hay độ sâu thanh khoản.</p>
<p>Giao dịch có rủi ro mất vốn. Perpetual có đòn bẩy có thể bị thanh lý. Cược prediction có thể về không. Tokenized Stocks là lớp crypto phản ánh phơi nhiễm cổ phiếu — không phải cổ phiếu môi giới truyền thống — và có thể khác về settlement, giờ giao dịch và quy định. Chỉ dùng số tiền bạn sẵn sàng mất.</p>`,
      },
    ],
    faq: [
      { q: 'GROM Exchange là gì?', a: 'GROM là terminal DeFi không lưu ký. Bạn giao dịch từ ví riêng trên Swap, perpetual, prediction markets và Tokenized Stocks mà không gửi ký vào tài khoản custodial của sàn.' },
      { q: 'Có cần tài khoản hoặc KYC không?', a: 'Giao dịch cơ bản từ ví không đòi email hay KYC của GROM. Third-party rails và một số khu vực có thể áp dụng kiểm tra riêng. Hãy tuân thủ luật địa phương.' },
      { q: 'Tiền của tôi ở đâu?', a: 'Trong ví và trên venue nơi bạn giao dịch. Phần mềm GROM giúp định tuyến và ký; không giữ tiền gửi người dùng.' },
      { q: 'Từ trang chủ mở sản phẩm nào?', a: 'Swap (/vi/swap), Trade cho spot và perpetual (/vi/futures), Predictions (/vi/predict), Stocks (/vi/stocks) và Markets (/vi/markets).' },
    ],
  },
  dashboard: {
    h1: 'Swap crypto cross-chain từ ví của bạn',
    lead: 'Đổi token giữa nhiều mạng mà không tạo số dư GROM. Instant Swap hỏi nhiều router, hiện báo giá và yêu cầu ví ký. Settlement on-chain về địa chỉ của bạn.',
    appName: 'GROM Instant Swap',
    appDesc: 'Aggregator Swap crypto cross-chain không lưu ký với chữ ký ví và settlement on-chain.',
    sections: [
      {
        h2: 'Instant Swap làm gì',
        html: `<p>Chọn token và mạng nguồn, token và mạng đích, rồi số lượng. GROM hỏi báo giá song song từ nhiều aggregator và bridge rồi hiện một lộ trình bạn có thể chấp nhận hoặc từ chối. Bạn không gửi gốc swap vào hot wallet của GROM.</p>
<p>Phạm vi gồm hàng nghìn token trên hơn hai mươi mạng khi có thanh khoản và bridge. Khả dụng thực tế phụ thuộc router lúc báo giá — cặp kém thanh khoản có thể không có lộ trình.</p>`,
      },
      {
        h2: 'Mạng, ví và chữ ký',
        html: `<p>Dùng ví self-custody có thể ký EVM (và hệ sinh thái khác mà desk hỗ trợ). Sau khi xác nhận, ví có thể yêu cầu approve rồi gửi swap hoặc bridge. Lộ trình cross-chain lâu hơn swap cùng mạng; theo dõi trạng thái trên desk và hoạt động ví.</p>
<p>Sản phẩm liền kề: <a href="${p('vi', '/futures')}">Trade</a> cho spot và perpetual, <a href="${p('vi', '/markets')}">Markets</a> cho giá, <a href="${p('vi', '/predict')}">Predictions</a> và <a href="${p('vi', '/stocks')}">Tokenized Stocks</a>.</p>`,
      },
      {
        h2: 'Phí, slippage và rủi ro',
        html: `<p>Mỗi báo giá liệt kê đầu ra ước tính, phí lộ trình và gas mạng. Slippage đặt mức biến động giá bạn chấp nhận. Bridge và DEX có thể thất bại, chậm hoặc trả ít hơn ước tính trên thị trường biến động.</p>
<p>Luôn kiểm tra hợp đồng, mạng và số lượng trong lời nhắc ví. GROM không đảm bảo “giá tốt nhất” hay bridge không rủi ro.</p>`,
      },
    ],
    faq: [
      { q: 'Instant Swap có lưu ký không?', a: 'Không. Bạn ký trong ví; settlement về địa chỉ của bạn. GROM không giữ gốc swap.' },
      { q: 'Tại sao không có lộ trình?', a: 'Aggregator có thể thiếu thanh khoản, bridge tạm dừng, hoặc từ chối cặp/kích thước. Thử token, mạng hoặc số lượng khác.' },
      { q: 'Phí nào áp dụng?', a: 'Routing fee trong báo giá cộng gas mạng nguồn (đôi khi cả đích). Phí bridge bên thứ ba có thể nằm trong lộ trình.' },
      { q: 'Sau swap có mở perps hoặc stocks được không?', a: 'Có. Khi token về ví, mở Trade (/vi/futures), Stocks (/vi/stocks) hoặc Predictions (/vi/predict) với cùng kết nối.' },
    ],
  },
  futures: {
    h1: 'Spot và perpetual futures từ ví của bạn',
    lead: 'Desk Trade cho phép mua bán spot và perpetual futures bằng chữ ký từ ví self-custody. Margin và vị thế sống trên trading venue — không trên tài khoản gửi ký GROM.',
    appName: 'GROM Trade',
    appDesc: 'Terminal spot và perpetual futures với chữ ký từ ví.',
    sections: [
      {
        h2: 'Spot và perps trong một terminal',
        html: `<p>Chuyển giữa chế độ spot và perpetual trên trang Trade. Ticket spot mua hoặc bán tài sản so với đồng báo giá. Ticket perpetual mở long hoặc short với đòn bẩy trong hạn mức venue.</p>
<p>Biểu đồ, số dư và lệnh mở cập nhật từ venue sau khi kết nối. Danh sách cặp gồm crypto chính và listing thêm của venue — khả dụng có thể đổi.</p>`,
      },
      {
        h2: 'Luồng ví và nạp quỹ',
        html: `<p>Kết nối ví, nạp venue khi sản phẩm yêu cầu, đặt lệnh market hoặc limit. Mọi thao tác nhạy cảm cần chữ ký hoặc giao dịch. Đóng hoặc giảm vị thế theo cùng mẫu ưu tiên ví.</p>
<p>Cần tài sản trên mạng khác — dùng <a href="${p('vi', '/swap')}">Swap</a>. Giá trên <a href="${p('vi', '/markets')}">Markets</a>; không cần login GROM riêng cho <a href="${p('vi', '/predict')}">Predictions</a> và <a href="${p('vi', '/stocks')}">Stocks</a>.</p>`,
      },
      {
        h2: 'Phí và rủi ro đòn bẩy',
        html: `<p>Ticket hiện phí ước tính trước khi xác nhận. Maker/taker phụ thuộc venue và loại lệnh. Có thể hiện phí builder hoặc nền tảng; nếu tạm dừng, ticket sẽ ghi rõ.</p>
<p>Đòn bẩy khuếch đại lãi và lỗ. Vị thế có thể bị thanh lý khi margin không đủ. Funding trên perpetual có thể cộng hoặc trừ theo thời gian. Đừng coi giao dịch perpetual là không rủi ro hay phù hợp mọi người.</p>`,
      },
    ],
    faq: [
      { q: 'Trade có đòi gửi ký GROM không?', a: 'Không có số dư custodial GROM. Bạn kết nối ví, nạp venue theo hướng dẫn sản phẩm và tự ký lệnh.' },
      { q: 'Spot khác perpetual thế nào?', a: 'Spot đổi chính tài sản. Perpetual theo thị trường với đòn bẩy và funding mà không giao tài sản gốc mỗi giao dịch.' },
      { q: 'Có thể mất nhiều hơn số đã nạp?', a: 'Thanh lý đóng vị thế khi hết margin, nhưng gap và phí vẫn có thể gây lỗ. Đọc quy tắc venue trước khi dùng đòn bẩy.' },
      { q: 'Xem giá ở đâu trước khi giao dịch?', a: 'Mở Markets (/vi/markets) hoặc biểu đồ Trade của cặp đã chọn.' },
    ],
  },
  predict: {
    h1: 'Prediction markets được tài trợ từ ví',
    lead: 'GROM Predictions cho phép mở vị thế trên kết quả sự kiện bằng tiền trong ví đã kết nối. Listing có thể gồm crypto, thể thao và chính trị. Thanh toán theo quy tắc thị trường — không theo quyết định tùy ý của GROM.',
    appName: 'GROM Predictions',
    appDesc: 'Prediction markets không lưu ký với tài trợ từ ví và settlement trên venue.',
    sections: [
      {
        h2: 'Prediction markets hoạt động thế nào tại đây',
        html: `<p>Xem sự kiện đang mở, đọc câu hỏi và quy tắc, mua hoặc bán outcome-share theo giá hiện. Giá phản ánh xác suất ngụ ý và có thể biến động. Đóng trước khi resolve là bán share lại cho thị trường.</p>
<p>Stake và claim dùng chữ ký ví cùng mạng của sản phẩm. GROM không giữ “số dư prediction” riêng.</p>`,
      },
      {
        h2: 'Bắt đầu và sản phẩm liên quan',
        html: `<p>Kết nối ví, chuẩn bị collateral thị trường yêu cầu, nhập kích thước rồi xác nhận. Cần bridge hoặc swap collateral trước — dùng <a href="${p('vi', '/swap')}">Instant Swap</a>. Giá vĩ mô trên <a href="${p('vi', '/markets')}">Markets</a>; đòn bẩy crypto trên <a href="${p('vi', '/futures')}">Trade</a>; token kiểu equity trên <a href="${p('vi', '/stocks')}">Stocks</a>.</p>
<p>Cùng một kết nối ví được dùng giữa các sản phẩm. Trước mỗi lệnh, đọc câu hỏi, nguồn resolve và dòng phí trên ticket — đó là điều kiện UI hiển thị, không phải bảo đảm riêng của GROM.</p>`,
      },
      {
        h2: 'Phí và rủi ro',
        html: `<p>Ticket tiết lộ phí giao dịch trước khi xác nhận. Spread và thanh khoản khác nhau — sổ mỏng có thể trượt. Nếu sự kiện resolve bất lợi, bạn có thể mất stake. Tranh chấp hoặc chậm resolve đều có thể xảy ra.</p>
<p>Prediction markets không phải sản phẩm cash-out nhà cái và không dành cho ai tìm thu nhập đảm bảo. Tuân thủ hạn chế khu vực với hợp đồng sự kiện. GROM không “bảo đảm” kết quả; chỉ phản ánh quy tắc venue và oracle.</p>`,
      },
    ],
    faq: [
      { q: 'Thắng prediction có vào số dư GROM không?', a: 'Không. Collateral và payout settle về ví qua venue của thị trường.' },
      { q: 'Có chủ đề nào?', a: 'Listing thay đổi. Có thể thấy crypto, thể thao, chính trị và danh mục khác khi thị trường mở.' },
      { q: 'Phí nào áp dụng?', a: 'Phí giao dịch venue trên ticket cộng gas mạng cho bước on-chain.' },
      { q: 'Resolve có thể chậm không?', a: 'Có. Resolve phụ thuộc oracle và quy tắc thị trường. Đọc điều khoản từng thị trường trước khi giao dịch.' },
    ],
  },
  xstocks: {
    h1: 'Tokenized Stocks (RWA) từ ví của bạn',
    lead: 'GROM Stocks mang lại phơi nhiễm cổ phiếu token hóa — token crypto theo dõi công ty niêm yết — để giao dịch kích thước phân đoạn ngoài giờ sàn truyền thống khi venue mở. Settlement về ví của bạn, không vào tài khoản môi giới GROM.',
    appName: 'GROM Stocks',
    appDesc: 'Tokenized stocks và RWA equity token giao dịch từ ví.',
    sections: [
      {
        h2: 'Tokenized Stocks là gì',
        html: `<p>Tokenized Stocks là biểu diễn on-chain của phơi nhiễm equity. Có thể giao dịch nhỏ hơn cả một cổ phiếu và có thể mở khi thị trường truyền thống đóng — tùy giờ và thanh khoản venue. Đây không phải cổ phiếu môi giới: lưu ký, quyền cổ đông và quy định khác nhau.</p>
<p>Tên công nghệ lớn của Mỹ có thể xuất hiện khi issuer và venue niêm yết. Luôn đọc công bố token và thị trường trong UI.</p>`,
      },
      {
        h2: 'Cách mua và bán',
        html: `<p>Kết nối ví, chọn Tokenized Stock, nhập kích thước rồi xác nhận. Có thể cần tài sản báo giá của venue (thường stablecoin) trên mạng đúng — dùng <a href="${p('vi', '/swap')}">Swap</a> nếu cần bridge. Theo dõi vị thế trên desk Stocks và danh sách token ví.</p>
<p>Kết hợp với <a href="${p('vi', '/futures')}">Trade</a> cho crypto spot/perps, <a href="${p('vi', '/predict')}">Predictions</a> cho sự kiện và <a href="${p('vi', '/markets')}">Markets</a> cho giá.</p>`,
      },
      {
        h2: 'Phí và rủi ro',
        html: `<p>Kỳ vọng phí giao dịch venue và gas mạng. Ngoài giờ cao điểm spread có thể nới. Equity token hóa có thể lệch giá tham chiếu, tạm dừng mint/redeem hoặc gặp hạn chế issuer và quy định.</p>
<p>Đây không phải lời khuyên đầu tư. Tokenized Stocks có thể mất giá và không khả dụng ở một số khu vực pháp lý.</p>`,
      },
    ],
    faq: [
      { q: 'Đây có phải cổ phiếu truyền thống?', a: 'Không. Đây là token crypto theo dõi phơi nhiễm equity. Quyền và lưu ký khác tài khoản môi giới được quản lý.' },
      { q: 'Giao dịch cuối tuần được không?', a: 'Venue có thể cho phép giao dịch crypto 24/7 với token, nhưng thanh khoản và giá có thể khác giờ sàn tuần.' },
      { q: 'Có cần KYC môi giới với GROM?', a: 'GROM không mở tài khoản môi giới cho bạn. Truy cập bằng ví là không lưu ký; issuer hoặc on-ramp có thể áp dụng quy tắc riêng.' },
      { q: 'Tài trợ mua thế nào?', a: 'Giữ tài sản báo giá cần thiết trong ví trên mạng được hỗ trợ rồi xác nhận lệnh. Dùng Swap để bridge hoặc đổi.' },
    ],
  },
  markets: {
    h1: 'Markets và giá trực tiếp trên GROM',
    lead: 'Markets là lớp khám phá của GROM: giá trực tiếp, movers và lối tắt sang Swap, Trade, Predictions, Stocks. Nó không lưu tiền — giúp chọn thị trường rồi nhảy sang desk phù hợp.',
    appName: 'GROM Markets',
    appDesc: 'Khám phá thị trường crypto và liên quan theo thời gian thực cho terminal DeFi GROM.',
    sections: [
      {
        h2: 'Bạn thấy gì trên Markets',
        html: `<p>Duyệt cặp và tài sản được liệt kê kèm ngữ cảnh giá gần đây. Mở một dòng để tiếp tục vào sản phẩm có thể giao dịch tài sản đó — ví dụ Instant Swap cho token cross-chain, Trade cho spot/perpetual, hoặc Stocks khi có Tokenized Stocks.</p>
<p>Số liệu cập nhật từ nguồn dữ liệu thị trường công khai. Có thể có khoảng trống hoặc trễ ngắn; trước khi ký hãy đối chiếu ticket sống.</p>`,
      },
      {
        h2: 'Từ giá đến giao dịch',
        html: `<p>Dùng Markets để so sánh nhanh rồi đi bằng liên kết thường: <a href="${p('vi', '/swap')}">Swap</a>, <a href="${p('vi', '/futures')}">Trade</a>, <a href="${p('vi', '/predict')}">Predictions</a>, <a href="${p('vi', '/stocks')}">Stocks</a> và <a href="${p('vi', '/')}">Trang chủ</a>. Cùng kết nối ví được dùng giữa các sản phẩm.</p>
<p>Màn hình khám phá không gửi lệnh. Nhấp một dòng mở desk tương ứng; tiền chỉ chuyển khi bạn ký trong ví. Chỉ số khối lượng hoặc xếp hạng không phải lời hứa marketing — chỉ là ảnh chụp feed hiện tại.</p>`,
      },
      {
        h2: 'Độ chính xác và rủi ro',
        html: `<p>GROM không tuyên bố dữ liệu độc quyền hay uptime đảm bảo cho mọi feed. Biểu đồ và bảng mang tính thông tin. Quyết định giao dịch là của bạn; phí và rủi ro được tiết lộ trên ticket từng sản phẩm.</p>
<p>Sản phẩm khác có thể dùng venue và mạng khác. Biểu tượng trên Markets không có nghĩa là Swap hoặc Trade sẵn sàng ngay — hãy kiểm tra hỗ trợ và số dư trên desk trước.</p>`,
      },
    ],
    faq: [
      { q: 'Markets có khớp lệnh không?', a: 'Markets để khám phá. Khớp lệnh xảy ra trên Swap, Trade, Predictions hoặc Stocks sau khi bạn xác nhận trong ví.' },
      { q: 'Giá có realtime không?', a: 'Chúng hướng tới gần realtime từ feed đã kết nối nhưng có thể trễ. Kiểm tra trên ticket lệnh.' },
      { q: 'Mở sản phẩm nào từ đây?', a: 'Tùy tài sản: Swap, Trade spot/perps, Predictions hoặc Tokenized Stocks.' },
      { q: 'Dữ liệu thị trường có lưu ký không?', a: 'Không. Xem giá không chuyển tiền. Chỉ chữ ký ví mới chuyển tài sản.' },
    ],
  },
};

export const SEO_COPY_ID = {
  landing: {
    h1: 'GROM Exchange — terminal DeFi non-kustodial',
    lead: 'GROM adalah hub kripto yang berpusat pada wallet. Anda menghubungkan wallet self-custody, menyimpan kunci sendiri, dan menandatangani setiap operasi. Tidak ada akun deposit di exchange dan tidak ada KYC GROM untuk trading dasar dari wallet.',
    appName: 'GROM Exchange',
    appDesc: 'Terminal DeFi non-kustodial untuk swap lintas chain, spot dan perpetual futures, prediction markets, dan tokenized stocks.',
    sections: [
      {
        h2: 'Empat lini produk, satu wallet',
        html: `<p>GROM menyatukan empat pasar dalam satu antarmuka: <a href="${p('id', '/swap')}">Swap lintas chain dan routing gaya spot</a>, <a href="${p('id', '/futures')}">perpetual futures dan spot</a>, <a href="${p('id', '/predict')}">prediction markets</a>, dan <a href="${p('id', '/stocks')}">Tokenized Stocks (RWA)</a>. Harga dan penemuan ada di <a href="${p('id', '/markets')}">Markets</a>.</p>
<p>Setiap produk settle ke alamat yang Anda kendalikan. Kuotasi dan fill datang dari venue dan aggregator on-chain; GROM tidak menyimpan saldo Anda.</p>`,
      },
      {
        h2: 'Bagaimana trading berjalan',
        html: `<p>Hubungkan wallet Web3 (ekstensi atau WalletConnect). Pilih produk, periksa kuotasi atau ticket, lalu konfirmasi tanda tangan atau transaksi di wallet. Aset bergerak di jaringan atau venue tujuan — bukan ke saldo GROM yang harus ditarik nanti.</p>
<p>Swap mencakup jaringan EVM utama dan ekosistem lain yang ditampilkan lapisan routing. Futures, predictions, dan Tokenized Stocks memakai jaringan yang diminta tiap produk. Sebelum menandatangani, selalu cocokkan jaringan dan aset di prompt wallet.</p>`,
      },
      {
        h2: 'Biaya dan risiko',
        html: `<p>Swap menampilkan routing fee di kuotasi plus gas jaringan. Perpetuals, Predictions, dan Tokenized Stocks memungut biaya venue yang diungkap di ticket sebelum konfirmasi. GROM tidak menjanjikan imbal hasil, volume, atau kedalaman likuiditas.</p>
<p>Trading membawa risiko kerugian. Perpetual berleverage bisa dilikuidasi. Taruhan prediction bisa menjadi nol. Tokenized Stocks adalah wrapper kripto untuk eksposur saham — bukan saham broker tradisional — dan bisa berbeda soal settlement, jam, serta regulasi. Gunakan hanya dana yang siap Anda hilangkan.</p>`,
      },
    ],
    faq: [
      { q: 'Apa itu GROM Exchange?', a: 'GROM adalah terminal DeFi non-kustodial. Anda berdagang dari wallet sendiri di Swap, perpetual, prediction markets, dan Tokenized Stocks tanpa deposit ke akun kustodial exchange.' },
      { q: 'Perlu akun atau KYC?', a: 'Trading dasar dari wallet tidak memerlukan akun email atau KYC GROM. Third-party rails dan beberapa wilayah bisa menerapkan pemeriksaan sendiri. Patuhi hukum setempat.' },
      { q: 'Di mana dana saya?', a: 'Di wallet Anda dan di venue tempat Anda berdagang. Perangkat lunak GROM membantu merutekan dan menandatangani; tidak menahan deposit pengguna.' },
      { q: 'Produk apa yang bisa dibuka dari beranda?', a: 'Swap (/id/swap), Trade untuk spot dan perpetual (/id/futures), Predictions (/id/predict), Stocks (/id/stocks), dan Markets (/id/markets).' },
    ],
  },
  dashboard: {
    h1: 'Swap kripto lintas chain dari wallet Anda',
    lead: 'Tukar token antar banyak jaringan tanpa membuat saldo GROM. Instant Swap meminta beberapa router, menampilkan kuotasi, dan meminta wallet menandatangani. Settlement on-chain ke alamat Anda.',
    appName: 'GROM Instant Swap',
    appDesc: 'Aggregator Swap kripto lintas chain non-kustodial dengan tanda tangan wallet dan settlement on-chain.',
    sections: [
      {
        h2: 'Apa yang dilakukan Instant Swap',
        html: `<p>Pilih token dan jaringan asal, token dan jaringan tujuan, lalu jumlah. GROM meminta kuotasi paralel dari beberapa aggregator dan bridge lalu menampilkan rute yang bisa Anda terima atau tolak. Anda tidak mengirim pokok swap ke hot wallet GROM.</p>
<p>Cakupan mencakup ribuan token di lebih dari dua puluh jaringan saat ada likuiditas dan bridge. Ketersediaan tepat bergantung pada router saat kuotasi — pasangan illiquid mungkin tidak punya rute.</p>`,
      },
      {
        h2: 'Jaringan, wallet, dan tanda tangan',
        html: `<p>Gunakan wallet self-custody yang bisa menandatangani EVM (dan ekosistem lain yang didukung desk). Setelah konfirmasi, wallet bisa meminta approve lalu mengirim swap atau bridge. Rute lintas chain lebih lama daripada swap satu jaringan; pantau status di desk dan aktivitas wallet.</p>
<p>Produk terkait: <a href="${p('id', '/futures')}">Trade</a> untuk spot dan perpetual, <a href="${p('id', '/markets')}">Markets</a> untuk harga, <a href="${p('id', '/predict')}">Predictions</a>, dan <a href="${p('id', '/stocks')}">Tokenized Stocks</a>.</p>`,
      },
      {
        h2: 'Biaya, slippage, dan risiko',
        html: `<p>Setiap kuotasi mencantumkan output perkiraan, biaya rute, dan gas jaringan. Slippage mengatur seberapa besar pergerakan harga yang Anda terima. Bridge dan DEX bisa gagal, tertunda, atau mengembalikan kurang dari perkiraan di pasar volatil.</p>
<p>Selalu periksa kontrak, jaringan, dan jumlah di prompt wallet. GROM tidak menjamin harga “terbaik” atau bridge tanpa risiko.</p>`,
      },
    ],
    faq: [
      { q: 'Apakah Instant Swap kustodial?', a: 'Tidak. Anda menandatangani di wallet; settlement ke alamat Anda. GROM tidak menyimpan pokok swap.' },
      { q: 'Mengapa tidak ada rute?', a: 'Aggregator mungkin kekurangan likuiditas, bridge dijeda, atau menolak pasangan/ukuran. Coba token, jaringan, atau jumlah lain.' },
      { q: 'Biaya apa yang berlaku?', a: 'Routing fee di kuotasi plus gas di jaringan asal (kadang tujuan). Biaya bridge pihak ketiga bisa masuk dalam rute.' },
      { q: 'Setelah swap, bisa buka perps atau stocks?', a: 'Ya. Saat token tiba di wallet, buka Trade (/id/futures), Stocks (/id/stocks), atau Predictions (/id/predict) dengan koneksi yang sama.' },
    ],
  },
  futures: {
    h1: 'Spot dan perpetual futures dari wallet Anda',
    lead: 'Desk Trade memungkinkan beli-jual spot dan perpetual futures dengan tanda tangan dari wallet self-custody. Margin dan posisi hidup di trading venue — bukan di akun deposit GROM.',
    appName: 'GROM Trade',
    appDesc: 'Terminal spot dan perpetual futures dengan tanda tangan dari wallet.',
    sections: [
      {
        h2: 'Spot dan perps dalam satu terminal',
        html: `<p>Beralih antara mode spot dan perpetual di halaman Trade. Ticket spot membeli atau menjual aset terhadap mata uang kuotasi. Ticket perpetual membuka long atau short dengan leverage dalam batas venue.</p>
<p>Grafik, saldo, dan order terbuka diperbarui dari venue setelah terhubung. Daftar pasangan mencakup kripto utama dan listing tambahan venue — ketersediaan bisa berubah.</p>`,
      },
      {
        h2: 'Alur wallet dan pendanaan',
        html: `<p>Hubungkan wallet, danai venue bila produk meminta, lalu pasang order market atau limit. Setiap aksi sensitif meminta tanda tangan atau transaksi. Menutup atau mengurangi posisi mengikuti pola wallet-first yang sama.</p>
<p>Butuh aset di jaringan lain — gunakan <a href="${p('id', '/swap')}">Swap</a>. Harga di <a href="${p('id', '/markets')}">Markets</a>; tanpa login GROM terpisah untuk <a href="${p('id', '/predict')}">Predictions</a> dan <a href="${p('id', '/stocks')}">Stocks</a>.</p>`,
      },
      {
        h2: 'Biaya dan risiko leverage',
        html: `<p>Ticket menampilkan biaya perkiraan sebelum konfirmasi. Maker/taker bergantung pada venue dan jenis order. Biaya builder atau platform bisa muncul; jika dijeda, ticket menunjukkannya.</p>
<p>Leverage memperbesar untung dan rugi. Posisi bisa dilikuidasi jika margin tidak cukup. Funding pada perpetual bisa mengkredit atau mendebit seiring waktu. Jangan anggap trading perpetual bebas risiko atau cocok untuk semua orang.</p>`,
      },
    ],
    faq: [
      { q: 'Apakah Trade membutuhkan deposit GROM?', a: 'Tidak ada saldo kustodial GROM. Anda menghubungkan wallet, mendanai venue sesuai produk, dan menandatangani order sendiri.' },
      { q: 'Apa beda spot dan perpetual?', a: 'Spot menukar aset itu sendiri. Perpetual mengikuti pasar dengan leverage dan funding tanpa menyerahkan aset dasar di setiap trade.' },
      { q: 'Bisa rugi lebih dari yang disetor?', a: 'Likuidasi menutup posisi saat margin habis, tetapi gap dan biaya tetap bisa menimbulkan kerugian. Pelajari aturan venue sebelum memakai leverage.' },
      { q: 'Di mana melihat harga sebelum trade?', a: 'Buka Markets (/id/markets) atau grafik Trade untuk pasangan yang dipilih.' },
    ],
  },
  predict: {
    h1: 'Prediction markets yang didanai dari wallet',
    lead: 'GROM Predictions memungkinkan posisi pada hasil peristiwa dengan dana di wallet yang terhubung. Listing dapat mencakup kripto, olahraga, dan politik. Resolusi mengikuti aturan pasar — bukan pembayaran diskresioner GROM.',
    appName: 'GROM Predictions',
    appDesc: 'Prediction markets non-kustodial dengan pendanaan dari wallet dan settlement di venue.',
    sections: [
      {
        h2: 'Bagaimana prediction markets bekerja di sini',
        html: `<p>Lihat peristiwa terbuka, baca pertanyaan dan aturan, beli atau jual outcome-share pada harga yang ditampilkan. Harga mencerminkan probabilitas tersirat dan bisa bergerak. Menutup sebelum resolusi menjual share kembali ke pasar.</p>
<p>Stake dan claim memakai tanda tangan wallet serta jaringan produk. Tidak ada “saldo prediction” yang disimpan GROM.</p>`,
      },
      {
        h2: 'Mulai dan produk terkait',
        html: `<p>Hubungkan wallet, siapkan collateral yang diminta pasar, masukkan ukuran lalu konfirmasi. Perlu bridge atau swap collateral dulu — gunakan <a href="${p('id', '/swap')}">Instant Swap</a>. Harga makro di <a href="${p('id', '/markets')}">Markets</a>; leverage kripto di <a href="${p('id', '/futures')}">Trade</a>; token gaya equity di <a href="${p('id', '/stocks')}">Stocks</a>.</p>
<p>Koneksi wallet yang sama dipakai antar produk. Sebelum tiap order, baca teks pertanyaan, sumber resolusi, dan baris biaya di ticket — itu kondisi yang ditampilkan UI, bukan jaminan terpisah dari GROM.</p>`,
      },
      {
        h2: 'Biaya dan risiko',
        html: `<p>Ticket mengungkap biaya trading sebelum konfirmasi. Spread dan likuiditas bervariasi — buku tipis bisa slip. Jika peristiwa resolve melawan Anda, stake bisa hilang. Sengketa atau resolusi lambat mungkin terjadi.</p>
<p>Prediction markets bukan produk cash-out bandar dan bukan untuk pencari pendapatan terjamin. Patuhi batasan regional untuk kontrak peristiwa. GROM tidak “menjamin” hasil; hanya mencerminkan aturan venue dan oracle.</p>`,
      },
    ],
    faq: [
      { q: 'Apakah kemenangan prediction masuk saldo GROM?', a: 'Tidak. Collateral dan payout settle ke wallet Anda melalui venue pasar.' },
      { q: 'Topik apa yang tersedia?', a: 'Listing berubah. Bisa ada kripto, olahraga, politik, dan kategori lain saat pasar terbuka.' },
      { q: 'Biaya apa yang berlaku?', a: 'Biaya trading venue di ticket plus gas jaringan untuk langkah on-chain.' },
      { q: 'Apakah resolusi bisa lambat?', a: 'Ya. Resolusi bergantung pada oracle dan aturan pasar. Baca syarat tiap pasar sebelum trading.' },
    ],
  },
  xstocks: {
    h1: 'Tokenized Stocks (RWA) dari wallet Anda',
    lead: 'GROM Stocks memberi eksposur saham yang ditokenisasi — token kripto yang mengikuti perusahaan tercatat — agar Anda bisa berdagang ukuran pecahan di luar jam bursa tradisional saat venue terbuka. Settlement ke wallet Anda, bukan rekening broker GROM.',
    appName: 'GROM Stocks',
    appDesc: 'Tokenized stocks dan token RWA equity yang diperdagangkan dari wallet.',
    sections: [
      {
        h2: 'Apa itu Tokenized Stocks',
        html: `<p>Tokenized Stocks adalah representasi on-chain dari eksposur equity. Bisa diperdagangkan lebih kecil dari satu saham dan mungkin tersedia saat pasar tradisional tutup — tergantung jam dan likuiditas venue. Ini bukan saham broker: kustodi, aksi korporasi, dan regulasi berbeda.</p>
<p>Nama teknologi besar AS bisa muncul saat issuer dan venue listing. Selalu baca pengungkapan token dan pasar di UI.</p>`,
      },
      {
        h2: 'Cara beli dan jual',
        html: `<p>Hubungkan wallet, pilih Tokenized Stock, masukkan ukuran lalu konfirmasi. Mungkin butuh aset kuotasi venue (sering stablecoin) di jaringan yang tepat — gunakan <a href="${p('id', '/swap')}">Swap</a> jika perlu bridge. Pantau posisi di desk Stocks dan daftar token wallet.</p>
<p>Padukan dengan <a href="${p('id', '/futures')}">Trade</a> untuk crypto spot/perps, <a href="${p('id', '/predict')}">Predictions</a> untuk peristiwa, dan <a href="${p('id', '/markets')}">Markets</a> untuk harga.</p>`,
      },
      {
        h2: 'Biaya dan risiko',
        html: `<p>Harapkan biaya trading venue dan gas jaringan. Di luar jam sibuk, spread bisa melebar. Equity yang ditokenisasi bisa menyimpang dari harga referensi, menjeda mint/redeem, atau menghadapi batasan issuer dan regulasi.</p>
<p>Ini bukan saran investasi. Tokenized Stocks bisa kehilangan nilai dan tidak tersedia di beberapa yurisdiksi.</p>`,
      },
    ],
    faq: [
      { q: 'Apakah ini saham tradisional?', a: 'Tidak. Ini token kripto yang mengikuti eksposur equity. Hak dan kustodi berbeda dari rekening broker yang teregulasi.' },
      { q: 'Bisa trading di akhir pekan?', a: 'Venue boleh mengizinkan trading kripto 24/7 untuk token, tetapi likuiditas dan harga bisa berbeda dari jam bursa hari kerja.' },
      { q: 'Perlu KYC broker dengan GROM?', a: 'GROM tidak membuka rekening broker untuk Anda. Akses via wallet non-kustodial; issuer atau on-ramp bisa menerapkan aturan sendiri.' },
      { q: 'Bagaimana mendanai pembelian?', a: 'Simpan aset kuotasi yang dibutuhkan di wallet pada jaringan yang didukung lalu konfirmasi trade. Gunakan Swap untuk bridge atau konversi.' },
    ],
  },
  markets: {
    h1: 'Markets dan harga live di GROM',
    lead: 'Markets adalah lapisan discovery GROM: harga live, movers, dan pintasan ke Swap, Trade, Predictions, Stocks. Tidak menyimpan dana — membantu memilih pasar lalu meloncat ke desk yang tepat.',
    appName: 'GROM Markets',
    appDesc: 'Discovery pasar kripto dan terkait secara live untuk terminal DeFi GROM.',
    sections: [
      {
        h2: 'Apa yang terlihat di Markets',
        html: `<p>Jelajahi pasangan dan aset yang terdaftar dengan konteks harga terkini. Buka baris untuk lanjut ke produk yang bisa memperdagangkan aset itu — misalnya Instant Swap untuk token lintas chain, Trade untuk spot/perpetual, atau Stocks saat Tokenized Stocks tersedia.</p>
<p>Angka diperbarui dari sumber data pasar publik. Bisa ada celah atau keterlambatan singkat; cocokkan ticket hidup sebelum menandatangani.</p>`,
      },
      {
        h2: 'Dari harga ke trade',
        html: `<p>Gunakan Markets untuk membandingkan cepat lalu lanjut lewat tautan biasa: <a href="${p('id', '/swap')}">Swap</a>, <a href="${p('id', '/futures')}">Trade</a>, <a href="${p('id', '/predict')}">Predictions</a>, <a href="${p('id', '/stocks')}">Stocks</a>, dan <a href="${p('id', '/')}">Beranda</a>. Koneksi wallet yang sama dipakai antar produk.</p>
<p>Layar discovery tidak mengirim order. Klik baris membuka desk terkait; dana bergerak hanya setelah Anda menandatangani di wallet. Metrik volume atau peringkat bukan janji pemasaran — hanya snapshot feed saat ini.</p>`,
      },
      {
        h2: 'Akurasi dan risiko',
        html: `<p>GROM tidak mengklaim data eksklusif atau uptime terjamin untuk setiap feed. Grafik dan tabel bersifat informatif. Keputusan trading ada di tangan Anda; biaya dan risiko diungkap di ticket tiap produk.</p>
<p>Produk berbeda bisa memakai venue dan jaringan berbeda. Simbol di Markets tidak berarti Swap atau Trade langsung siap — periksa dukungan dan saldo di desk dulu.</p>`,
      },
    ],
    faq: [
      { q: 'Apakah Markets mengeksekusi trade?', a: 'Markets untuk discovery. Eksekusi terjadi di Swap, Trade, Predictions, atau Stocks setelah Anda konfirmasi di wallet.' },
      { q: 'Apakah harga realtime?', a: 'Mereka bertujuan hampir realtime dari feed terhubung, tetapi bisa tertinggal. Verifikasi di ticket order.' },
      { q: 'Produk apa yang bisa dibuka dari sini?', a: 'Bergantung aset: Swap, Trade spot/perps, Predictions, atau Tokenized Stocks.' },
      { q: 'Apakah data pasar kustodial?', a: 'Tidak. Melihat harga tidak memindahkan dana. Hanya tanda tangan wallet yang memindahkan aset.' },
    ],
  },
};
