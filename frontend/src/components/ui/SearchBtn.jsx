import { Search } from "lucide-react";

const SearchBtn = ({ className = "" }) => {
    const finalClasses = `${className} btn-icon`;

    return (
        <button className={finalClasses}>
            <Search className="w-6 h-6" />
        </button>
    );
};

export default SearchBtn;