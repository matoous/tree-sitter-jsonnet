const
    PREC = {
        unary: 7,
        binary_mult: 6,
        binary_add: 5,
        binary_ord: 4,
        binary_comp: 3,
        binary_and: 2,
        binary_or: 1,

        // if possible prefer string_literals to quoted templates
        string_lit: 2,
        quoted_template: 1,
    }

module.exports = grammar({
    name: 'jsonnet',

    extras: $ => [
        $.comment,
        $._whitespace,
    ],

    rules: {
        config_file: $ => repeat($._value),

        _value: $ => choice(
            // TODO: function call, etc
            $.array,
            $.object,
            $.number,
            $.string,
            $.true,
            $.false,
            $.null
        ),

        object: $ => seq(
            "{", repeat(seq($.pair, ",")), "}"
        ),

        pair: $ => seq(
            $.key,
            ":",
            field("value", $.expression)
        ),

        array: $ => seq(
            "[", commaSep($._value), "]"
        ),

        key: $ => /[\w\d_-]+/,

        string: $ => choice(
            seq('"', '"'),
            seq('"', $.string_content, '"')
        ),

        variable_expr: $ => prec.right($.identifier),

        string_content: $ => repeat1(choice(
            token.immediate(/[^\\"\n]+/),
            $.escape_sequence
        )),

        index: $ => seq('[', $.expression, ']'),

        splat: $ => choice($.attr_splat, $.full_splat),

        attr_splat: $ => prec.right(seq(
            '.*',
            repeat(choice($.get_attr, $.index)),
        )),

        full_splat: $ => prec.right(seq(
            '[*]',
            repeat(choice($.get_attr, $.index)),
        )),

        get_attr: $ => seq('.', $.identifier),

        identifier: $ => token(seq(
            choice(/\p{ID_Start}/, '_'),
            repeat(choice(/\p{ID_Continue}/, '-')),
        )),

        expression: $ => choice(
            $._value,
            $.variable_expr,
            $.operation,
            seq($.expression, $.index),
            seq($.expression, $.get_attr),
            seq($.expression, $.splat),
            seq('(', $.expression, ')'),
        ),

        operation: $ => choice($.unary_operation, $.binary_operation),

        unary_operation: $ => prec.left(PREC.unary, seq(choice('-', '!'), $.expression)),

        binary_operation: $ => {
            const table = [
                [PREC.binary_mult, choice('*', '/', '%')],
                [PREC.binary_add, choice('+', '-')],
                [PREC.binary_ord, choice('>', '>=', '<', '<=')],
                [PREC.binary_comp, choice('==', '!=')],
                [PREC.binary_and, choice('&&')],
                [PREC.binary_or, choice('||')],
            ];

            return choice(...table.map(([precedence, operator]) =>
                prec.left(precedence, seq($.expression, operator, $.expression), )));
        },

        escape_sequence: $ => token.immediate(seq(
            '\\',
            /(\"|\\|\/|b|f|n|r|t|u)/
        )),

        number: $ => {
            const hex_literal = seq(
                choice('0x', '0X'),
                /[\da-fA-F]+/
            )

            const decimal_digits = /\d+/
            const signed_integer = seq(optional(choice('-', '+')), decimal_digits)
            const exponent_part = seq(choice('e', 'E'), signed_integer)

            const binary_literal = seq(choice('0b', '0B'), /[0-1]+/)

            const octal_literal = seq(choice('0o', '0O'), /[0-7]+/)

            const decimal_integer_literal = seq(
                optional(choice('-', '+')),
                choice(
                    '0',
                    seq(/[1-9]/, optional(decimal_digits))
                )
            )

            const decimal_literal = choice(
                seq(decimal_integer_literal, '.', optional(decimal_digits), optional(exponent_part)),
                seq('.', decimal_digits, optional(exponent_part)),
                seq(decimal_integer_literal, optional(exponent_part))
            )

            return token(choice(
                hex_literal,
                decimal_literal,
                binary_literal,
                octal_literal
            ))
        },

        true: $ => "true",

        false: $ => "false",

        null: $ => "null",

        comment: $ => token(choice(
            seq('#', /.*/),
            seq('//', /.*/),
            seq(
                '/*',
                /[^*]*\*+([^/*][^*]*\*+)*/,
                '/'
            )
        )),
        _whitespace: $ => token(/\s/),
    }
});

function commaSep1(rule) {
    return seq(rule, repeat(seq(",", rule)))
}

function commaSep(rule) {
    return optional(commaSep1(rule))
}