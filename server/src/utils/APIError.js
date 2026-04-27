class APIError extends Error{
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
    ){
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.data = null;
        this.success = false;
        this.errors = errors;
    };
}

export {APIError};